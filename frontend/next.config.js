/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@promexma/ui"],
  serverExternalPackages: ["read-excel-file"],
  ...(process.env.VERCEL
    ? {}
    : { turbopack: { root: __dirname }, outputFileTracingRoot: __dirname }),
};

module.exports = nextConfig;
