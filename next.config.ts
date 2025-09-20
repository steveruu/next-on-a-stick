import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",

    // Use /data/.next for build output in Docker environment
    // This allows the build artifacts to be in the writable volume
    distDir: process.env.DOCKER_ENV === "true" ? "/data/.next" : ".next",

    // Configure image optimization for read-only filesystem
    images: {
        // Disable image optimization in production to avoid cache issues
        unoptimized: process.env.NODE_ENV === "production",
    },

    // Configure output tracing for standalone build
    outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
