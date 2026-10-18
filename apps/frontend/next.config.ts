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
  cacheComponents: true,
  partialPrefetching: true,
  // Shared packages ship TypeScript source
  transpilePackages: ["@vet-plan/ui", "@vet-plan/app", "react-native-web"],
  turbopack: {
    resolveAlias: {
      // React Native primitives render through react-native-web, with `className` support
      // added by our shim (NativeWind has no Next.js integration yet; see the shim's header)
      "react-native": "@vet-plan/ui/react-native-web-shim",
    },
    // Shared files are the web version; `*.native.*` overrides them on mobile (Metro resolves
    // those first). `*.web.*` is honoured too for packages that ship web-specific files.
    resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
