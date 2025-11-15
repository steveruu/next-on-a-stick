/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    unoptimized: process.env.NODE_ENV === "production",
  },
  outputFileTracingRoot: process.cwd(),
};

module.exports = nextConfig;
