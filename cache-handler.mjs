import fs from "fs/promises";
import path from "path";

// Determine cache directory - use /data in production (Docker), .next/cache in development
const cacheDir =
    process.env.NODE_ENV === "production" ? "/data/.next-cache" : ".next/cache";

export default class CustomCacheHandler {
    constructor(options) {
        this.options = options;
        this.ensureCacheDir();
        this.clearStaleCache();
    }

    async ensureCacheDir() {
        try {
            await fs.access(cacheDir);
        } catch {
            await fs.mkdir(cacheDir, { recursive: true });
        }
    }

    async clearStaleCache() {
        // Clear cache on startup to prevent stale server action IDs
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
                console.log("Clearing stale cache for new deployment");
                const files = await fs.readdir(cacheDir);
                await Promise.all(
                    files
                        .filter((file) => file.endsWith(".json"))
                        .map((file) =>
                            fs.unlink(path.join(cacheDir, file)).catch(() => {})
                        )
                );
                await fs.writeFile(deploymentMarker, buildId);
            }
        } catch (error) {
            console.warn("Failed to clear stale cache:", error);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async get(key, _fetchCache, _fetchUrl, _fetchIdx) {
        // Don't cache server actions as they have deployment-specific IDs
        if (this.isServerAction(key)) {
            return null;
        }

        try {
            const filePath = path.join(
                cacheDir,
                `${this.sanitizeKey(key)}.json`
            );
            const data = await fs.readFile(filePath, "utf8");
            const parsed = JSON.parse(data);

            // Check if expired
            if (
                parsed.lastModified &&
                parsed.revalidateAfter &&
                Date.now() > parsed.revalidateAfter
            ) {
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
            const filePath = path.join(
                cacheDir,
                `${this.sanitizeKey(key)}.json`
            );

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

    async delete(key) {
        try {
            const filePath = path.join(
                cacheDir,
                `${this.sanitizeKey(key)}.json`
            );
            await fs.unlink(filePath);
        } catch {
            // File doesn't exist, that's fine
        }
    }

    async revalidateTag(tag) {
        console.log("Revalidating tag:", tag);
        try {
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

    isServerAction(key) {
        // Server actions typically have specific patterns in their keys
        return (
            key.includes("server-action") ||
            key.includes("action-") ||
            /^[a-f0-9]{40,}$/.test(key) || // Hex hash pattern like the error shows
            key.includes("$$ACTION_")
        );
    }

    sanitizeKey(key) {
        // Replace invalid filename characters
        return key.replace(/[<>:"/\\|?*]/g, "_");
    }
}
