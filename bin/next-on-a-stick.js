#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const recast = require("recast");
const parser = require("@babel/parser");

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const TEMPLATE_FILES = [
    { template: "Dockerfile", target: "Dockerfile" },
    { template: ".dockerignore", target: ".dockerignore" },
    { template: "docker-entrypoint.sh", target: "docker-entrypoint.sh", mode: 0o755 },
];

const CONFIG_CANDIDATES = [
    "next.config.ts",
    "next.config.mjs",
    "next.config.js",
    "next.config.cjs",
];

const PARSER = {
    parse(source) {
        return parser.parse(source, {
            sourceType: "module",
            plugins: [
                "typescript",
                "jsx",
                "classProperties",
                "decorators-legacy",
                "topLevelAwait",
            ],
        });
    },
};

function parseArgs(argv) {
    const args = argv.slice(2);
    const options = {
        cwd: process.cwd(),
        force: false,
        dryRun: false,
    };

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        switch (arg) {
            case "--force":
            case "-f":
                options.force = true;
                break;
            case "--dry-run":
            case "-n":
                options.dryRun = true;
                break;
            case "--cwd":
                if (!args[i + 1]) {
                    throw new Error("--cwd requires a value");
                }
                options.cwd = path.resolve(args[i + 1]);
                i += 1;
                break;
            case "--help":
            case "-h":
                printHelp();
                process.exit(0);
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return options;
}

function printHelp() {
    const text = `
Usage: npx next-on-a-stick [options]

Adds the Docker + read-only filesystem scaffolding described in the README to the current Next.js project.

Options:
  --force, -f     Overwrite existing files instead of skipping them.
  --dry-run, -n   Show the actions without writing files.
  --cwd <dir>     Run against a different directory (defaults to process.cwd()).
  --help, -h      Show this message.
`;
    process.stdout.write(text);
}

function ensureNextProject(cwd) {
    const pkgPath = path.join(cwd, "package.json");
    if (!fs.existsSync(pkgPath)) {
        throw new Error(`package.json not found in ${cwd}`);
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    if (!deps.next) {
        console.warn("[warn] This project does not depend on Next.js. Continuing anyway.");
    }
}

function copyTemplate({ template, target, mode }, options) {
    const src = path.join(TEMPLATES_DIR, template);
    const dest = path.join(options.cwd, target);
    const rel = path.relative(options.cwd, dest) || target;
    if (!fs.existsSync(src)) {
        throw new Error(`Template "${template}" is missing from the package.`);
    }

    if (fs.existsSync(dest) && !options.force) {
        console.log(`[skip] ${rel} already exists. Use --force to overwrite.`);
        return;
    }

    if (options.dryRun) {
        console.log(`[dry-run] Would copy ${rel}`);
        return;
    }

    fs.copyFileSync(src, dest);
    if (mode) {
        fs.chmodSync(dest, mode);
    }
    console.log(`[write] ${rel}`);
}

function createNextConfig(options) {
    const prefersTs = fs.existsSync(path.join(options.cwd, "tsconfig.json"));
    const filename = prefersTs ? "next.config.ts" : "next.config.js";
    const templateName = prefersTs ? "next.config.ts" : "next.config.js";
    copyTemplate({ template: templateName, target: filename }, options);
    return path.join(options.cwd, filename);
}

function patchNextConfig(options) {
    let configPath = null;
    for (const candidate of CONFIG_CANDIDATES) {
        const abs = path.join(options.cwd, candidate);
        if (fs.existsSync(abs)) {
            configPath = abs;
            break;
        }
    }

    if (!configPath) {
        console.log("[info] No next.config.* found. Creating a new one.");
        configPath = createNextConfig(options);
        return;
    }

    const code = fs.readFileSync(configPath, "utf8");
    const rel = path.relative(options.cwd, configPath);
    try {
        const updated = transformNextConfig(code);
        if (!updated.changed) {
            console.log(`[skip] ${rel} already contains the required settings.`);
            return;
        }
        if (options.dryRun) {
            console.log(`[dry-run] Would update ${rel}`);
            return;
        }
        fs.writeFileSync(configPath, updated.code);
        console.log(`[write] Patched ${rel}`);
    } catch (error) {
        console.warn(`[warn] Could not automatically update ${rel}: ${error.message}`);
        console.warn("Please add output:'standalone', images.unoptimized, and outputFileTracingRoot manually.");
    }
}

function transformNextConfig(source) {
    const ast = recast.parse(source, {
        parser: PARSER,
    });

    const objectMap = new Map();
    const { visit } = recast.types;

    visit(ast, {
        visitVariableDeclarator(path) {
            const id = path.node.id;
            if (id && id.type === "Identifier") {
                const candidate = unwrapExpression(path.node.init);
                if (candidate && candidate.type === "ObjectExpression") {
                    objectMap.set(id.name, candidate);
                } else if (candidate && candidate.type === "CallExpression") {
                    const nested = findObjectInCall(candidate, objectMap);
                    if (nested) {
                        objectMap.set(id.name, nested);
                    }
                }
            }
            this.traverse(path);
        },
    });

    let target = null;
    visit(ast, {
        visitAssignmentExpression(path) {
            if (isModuleExports(path.node.left) || isExportsDefault(path.node.left)) {
                const resolved = resolveConfigTarget(path.node.right, objectMap);
                if (resolved) {
                    target = resolved;
                    return false;
                }
            }
            this.traverse(path);
        },
        visitExportDefaultDeclaration(path) {
            const resolved = resolveConfigTarget(path.node.declaration, objectMap);
            if (resolved) {
                target = resolved;
                return false;
            }
            this.traverse(path);
        },
    });

    if (!target) {
        throw new Error("Could not find the exported Next.js config object.");
    }

    const changes = applyConfigMutations(target);
    return { code: recast.print(ast).code, changed: changes > 0 };
}

function unwrapExpression(node) {
    let current = node;
    while (
        current &&
        (current.type === "TSAsExpression" ||
            current.type === "TSSatisfiesExpression" ||
            current.type === "TSNonNullExpression" ||
            current.type === "ParenthesizedExpression")
    ) {
        current = current.expression;
    }
    return current;
}

function isModuleExports(node) {
    return (
        node &&
        node.type === "MemberExpression" &&
        !node.computed &&
        node.object.type === "Identifier" &&
        node.object.name === "module" &&
        node.property.type === "Identifier" &&
        node.property.name === "exports"
    );
}

function isExportsDefault(node) {
    return (
        node &&
        node.type === "MemberExpression" &&
        !node.computed &&
        node.object.type === "Identifier" &&
        node.object.name === "exports" &&
        node.property.type === "Identifier" &&
        node.property.name === "default"
    );
}

function resolveConfigTarget(node, objectMap) {
    if (!node) {
        return null;
    }
    const unwrapped = unwrapExpression(node);
    if (!unwrapped) {
        return null;
    }

    if (unwrapped.type === "ObjectExpression") {
        return unwrapped;
    }

    if (unwrapped.type === "Identifier") {
        return objectMap.get(unwrapped.name) || null;
    }

    if (unwrapped.type === "CallExpression") {
        return findObjectInCall(unwrapped, objectMap);
    }

    return null;
}

function findObjectInCall(callExpression, objectMap) {
    for (const arg of callExpression.arguments) {
        const candidate = unwrapExpression(arg);
        if (!candidate) {
            continue;
        }
        if (candidate.type === "ObjectExpression") {
            return candidate;
        }
        if (candidate.type === "Identifier" && objectMap.has(candidate.name)) {
            return objectMap.get(candidate.name);
        }
        if (candidate.type === "CallExpression") {
            const nested = findObjectInCall(candidate, objectMap);
            if (nested) {
                return nested;
            }
        }
    }
    return null;
}

function findProperty(properties, name) {
    return properties.find((prop) => {
        if (
            (prop.type === "ObjectProperty" || prop.type === "Property") &&
            !prop.computed
        ) {
            if (prop.key.type === "Identifier" && prop.key.name === name) {
                return true;
            }
            if (prop.key.type === "StringLiteral" && prop.key.value === name) {
                return true;
            }
        }
        return false;
    });
}

function applyConfigMutations(target) {
    const { builders: b } = recast.types;
    let changes = 0;

    changes += ensureStringProperty(target, "output", "standalone", b);
    const tracingProp = findProperty(target.properties, "outputFileTracingRoot");
    changes += ensureProcessCwdProperty(target, tracingProp, b);

    let imagesProp = findProperty(target.properties, "images");
    if (!imagesProp) {
        imagesProp = b.objectProperty(
            b.identifier("images"),
            b.objectExpression([]),
        );
        target.properties.push(imagesProp);
        changes += 1;
    }

    const imagesValueNode = unwrapExpression(imagesProp.value);
    const imagesValue =
        imagesValueNode && imagesValueNode.type === "ObjectExpression"
            ? imagesValueNode
            : null;
    if (!imagesValue) {
        return changes;
    }

    changes += ensureImagesUnoptimized(imagesValue, b);

    return changes;
}

function ensureStringProperty(target, propertyName, value, b) {
    const prop = findProperty(target.properties, propertyName);
    const literal = b.stringLiteral(value);
    if (!prop) {
        target.properties.push(b.objectProperty(b.identifier(propertyName), literal));
        return 1;
    }
    const existing = unwrapExpression(prop.value);
    if (existing && existing.type === "StringLiteral" && existing.value === value) {
        return 0;
    }
    prop.value = literal;
    return 1;
}

function ensureProcessCwdProperty(target, prop, b) {
    const call = b.callExpression(
        b.memberExpression(b.identifier("process"), b.identifier("cwd")),
        [],
    );
    if (!prop) {
        target.properties.push(
            b.objectProperty(b.identifier("outputFileTracingRoot"), call),
        );
        return 1;
    }
    const existing = unwrapExpression(prop.value);
    if (
        existing &&
        existing.type === "CallExpression" &&
        existing.callee.type === "MemberExpression" &&
        existing.callee.object.type === "Identifier" &&
        existing.callee.object.name === "process" &&
        existing.callee.property.type === "Identifier" &&
        existing.callee.property.name === "cwd"
    ) {
        return 0;
    }
    prop.value = call;
    return 1;
}

function ensureImagesUnoptimized(imagesObject, b) {
    const prop = findProperty(imagesObject.properties, "unoptimized");
    const envNode = b.memberExpression(
        b.memberExpression(b.identifier("process"), b.identifier("env")),
        b.identifier("NODE_ENV"),
    );
    const comparison = b.binaryExpression(
        "===",
        envNode,
        b.stringLiteral("production"),
    );

    if (!prop) {
        imagesObject.properties.push(
            b.objectProperty(b.identifier("unoptimized"), comparison),
        );
        return 1;
    }
    const existing = unwrapExpression(prop.value);
    if (
        existing &&
        existing.type === "BinaryExpression" &&
        existing.operator === "===" &&
        existing.left.type === "MemberExpression" &&
        existing.left.object.type === "MemberExpression" &&
        existing.left.object.object.type === "Identifier" &&
        existing.left.object.object.name === "process" &&
        existing.left.object.property.type === "Identifier" &&
        existing.left.object.property.name === "env" &&
        existing.left.property.type === "Identifier" &&
        existing.left.property.name === "NODE_ENV" &&
        existing.right.type === "StringLiteral" &&
        existing.right.value === "production"
    ) {
        return 0;
    }
    prop.value = comparison;
    return 1;
}

function main() {
    try {
        const options = parseArgs(process.argv);
        ensureNextProject(options.cwd);
        TEMPLATE_FILES.forEach((file) => copyTemplate(file, options));
        patchNextConfig(options);
        console.log("Done. Build your image with docker build -t <app> .");
    } catch (error) {
        console.error(`[error] ${error.message}`);
        process.exit(1);
    }
}

main();
