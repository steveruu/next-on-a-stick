import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    images: {
        unoptimized: process.env.NODE_ENV === "production",
    },
    outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
