import fs from "fs/promises";
import path from "path";

// Determine cache directory - use /data in production (Docker), .next/cache in development
const cacheDir =
    process.env.NODE_ENV === "production" ? "/data/.next-cache" : ".next/cache";

// Global flag to ensure cache clearing only happens once per deployment
let cacheCleared = false;

export default class MinimalCacheHandler {
    constructor(options) {
        this.options = options;
        this.ensureCacheDir();

        // Clear cache once per deployment to prevent stale server action IDs
        if (!cacheCleared) {
            this.clearStaleCache();
            cacheCleared = true;
        }
    }

    async ensureCacheDir() {
        try {
            await fs.access(cacheDir);
        } catch {
            await fs.mkdir(cacheDir, { recursive: true });
        }
    }

    async clearStaleCache() {
        try {
            const deploymentMarker = path.join(cacheDir, "deployment.marker");
            const buildId = process.env.BUILD_ID || Date.now().toString();

            let shouldClear = false;
            try {
                const lastBuildId = await fs.readFile(deploymentMarker, "utf8");
                if (lastBuildId !== buildId) {
                    shouldClear = true;
                }
            } catch {
                // File doesn't exist, first run
                shouldClear = true;
            }

            if (shouldClear) {
                console.log(
                    "Clearing stale cache for new deployment (Build ID: " +
                        buildId +
                        ")"
                );
                const files = await fs.readdir(cacheDir);
                const jsonFiles = files.filter((file) =>
                    file.endsWith(".json")
                );
                await Promise.all(
                    jsonFiles.map((file) =>
                        fs.unlink(path.join(cacheDir, file)).catch(() => {})
                    )
                );
                await fs.writeFile(deploymentMarker, buildId);
                console.log(`Cache cleared: ${jsonFiles.length} files removed`);
            }
        } catch (error) {
            console.warn("Failed to clear stale cache:", error);
        }
    }

    async get(key, _fetchCache, _fetchUrl, _fetchIdx) {
        // Don't cache server actions as they have deployment-specific IDs
        if (this.isServerAction(key)) {
            return null;
        }

        try {
            const filePath = this.getFilePath(key);
            const data = await fs.readFile(filePath, "utf8");
            const parsed = JSON.parse(data);

            // Check if expired
            if (parsed.revalidateAfter && Date.now() > parsed.revalidateAfter) {
                return null;
            }

            return {
                lastModified: parsed.lastModified,
                value: parsed.value,
            };
        } catch {
            return null;
        }
    }

    async set(key, data, ctx) {
        // Don't cache server actions as they have deployment-specific IDs
        if (this.isServerAction(key)) {
            return;
        }

        try {
            await this.ensureCacheDir();
            const filePath = this.getFilePath(key);

            const now = Date.now();
            const cacheData = {
                lastModified: now,
                value: data,
                revalidateAfter: ctx?.revalidate
                    ? now + ctx.revalidate * 1000
                    : undefined,
                tags: ctx?.tags || [],
            };

            await fs.writeFile(filePath, JSON.stringify(cacheData));
        } catch (error) {
            console.warn("Failed to write cache:", error);
        }
    }

    async revalidateTag(tag) {
        try {
            await this.ensureCacheDir();
            const files = await fs.readdir(cacheDir);

            for (const file of files) {
                if (file.endsWith(".json")) {
                    try {
                        const filePath = path.join(cacheDir, file);
                        const data = await fs.readFile(filePath, "utf8");
                        const parsed = JSON.parse(data);

                        if (parsed.tags && parsed.tags.includes(tag)) {
                            await fs.unlink(filePath);
                        }
                    } catch {
                        // Ignore errors for individual files
                    }
                }
            }
        } catch (error) {
            console.warn("Failed to revalidate tag:", error);
        }
    }

    async resetRequestCache() {
        // This method is called to reset the cache for a specific request
        // For a minimal implementation, we don't need to do anything special here
    }

    getFilePath(key) {
        const sanitizedKey = key.replace(/[<>:"/\\|?*]/g, "_");
        return path.join(cacheDir, `${sanitizedKey}.json`);
    }

    isServerAction(key) {
        // Server actions typically have specific patterns in their keys
        return (
            key.includes("server-action") ||
            key.includes("action-") ||
            /^[a-f0-9]{40,}$/.test(key) || // Hex hash pattern like "60a34c20f04908040f1ab6e1946309ecf4988aa182"
            key.includes("$$ACTION_")
        );
    }
}
