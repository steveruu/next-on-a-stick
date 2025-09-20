import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",

    // Configure image optimization for read-only filesystem
    images: {
        // Disable image optimization in production to avoid cache issues
        unoptimized: process.env.NODE_ENV === "production",
    },

    // Configure output tracing for standalone build
    outputFileTracingRoot: process.cwd(),
    cacheHandler: require.resolve("./cache-handler.js"),
};

export default nextConfig;
