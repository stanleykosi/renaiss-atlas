import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@renaiss/core", "@renaiss/db", "@renaiss/ui"],
  poweredByHeader: false
};

export default nextConfig;
