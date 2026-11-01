import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  // Providers are called server-side only; keep the client bundle free of
  // provider credentials and provider SDKs.
  eslint: {
    // Linting runs as a separate step; do not block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
