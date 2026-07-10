import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoEnvPath = path.join(repoRoot, ".env");

// Next runs from apps/web, while local setup keeps the shared environment at the repo root.
if (existsSync(repoEnvPath)) {
  loadEnvFile(repoEnvPath);
}

const sentryAuthToken = process.env["SENTRY_AUTH_TOKEN"];
const hasSentryAuthToken = sentryAuthToken != null && sentryAuthToken.trim().length > 0;

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@renaiss/core", "@renaiss/ai"],
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  webpack(config) {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"]
    };

    return config;
  }
};

export default withSentryConfig(nextConfig, {
  ...(process.env["SENTRY_ORG"] == null ? {} : { org: process.env["SENTRY_ORG"] }),
  ...(process.env["SENTRY_PROJECT"] == null ? {} : { project: process.env["SENTRY_PROJECT"] }),
  ...(hasSentryAuthToken ? { authToken: sentryAuthToken } : {}),
  silent: !process.env["CI"],
  webpack: {
    treeshake: {
      removeDebugLogging: process.env["NODE_ENV"] === "production"
    }
  },
  sourcemaps: {
    disable: !hasSentryAuthToken,
    deleteSourcemapsAfterUpload: true
  }
});
