#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = [
    ["Dockerfile", "templates/Dockerfile"],
    ["docker-entrypoint.sh", "templates/docker-entrypoint.sh"],
    ["docker-compose.yml", "templates/docker-compose.yml"],
];

for (const [sourceRel, destRel] of FILES) {
    const source = path.join(ROOT, sourceRel);
    const dest = path.join(ROOT, destRel);
    if (!fs.existsSync(source)) {
        throw new Error(`Source file missing: ${sourceRel}`);
    }
    const dir = path.dirname(dest);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(source, dest);
    console.log(`Synced ${sourceRel} -> ${destRel}`);
}
