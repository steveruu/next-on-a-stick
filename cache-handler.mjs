import fs from "fs/promises";
import path from "path";

// Determine cache directory - use /data in production (Docker), .next/cache in development
const cacheDir =
    process.env.NODE_ENV === "production" ? "/data/.next-cache" : ".next/cache";

export default class CustomCacheHandler {
    constructor(options) {
        this.options = options;
        this.ensureCacheDir();
    }

    async ensureCacheDir() {
        try {
            await fs.access(cacheDir);
        } catch {
            await fs.mkdir(cacheDir, { recursive: true });
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async get(key, _fetchCache, _fetchUrl, _fetchIdx) {
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

    sanitizeKey(key) {
        // Replace invalid filename characters
        return key.replace(/[<>:"/\\|?*]/g, "_");
    }
}
