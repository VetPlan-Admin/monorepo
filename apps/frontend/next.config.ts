import path from "node:path";
import type { NextConfig } from "next";

// Next.js only reads .env files from apps/frontend. Also load the monorepo root .env
// (variables that are already set, including apps/frontend/.env*, take precedence).
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // Root .env is optional (e.g. CI, production hosting)
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
