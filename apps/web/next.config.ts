import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, "../..");
const sentryStubPath = path.resolve(appRoot, "lib/sentry-stub.ts");

const sentryAuthToken = process.env["SENTRY_AUTH_TOKEN"];
const sentryConfigured =
  (process.env["SENTRY_DSN"] != null && process.env["SENTRY_DSN"] !== "") ||
  (process.env["NEXT_PUBLIC_SENTRY_DSN"] != null && process.env["NEXT_PUBLIC_SENTRY_DSN"] !== "") ||
  (sentryAuthToken != null && sentryAuthToken !== "");

const shouldUseRealSentryPackage = sentryConfigured && process.env["NODE_ENV"] === "production";

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@renaiss/core", "@renaiss/db", "@renaiss/discord", "@renaiss/ui"],
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  webpack(config) {
    if (!shouldUseRealSentryPackage) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@sentry/nextjs": sentryStubPath
      };
    }

    return config;
  }
};

export default async function getNextConfig(): Promise<NextConfig> {
  if (!shouldUseRealSentryPackage) {
    return nextConfig;
  }

  const { withSentryConfig } = await import("@sentry/nextjs");

  return withSentryConfig(nextConfig, {
    ...(process.env["SENTRY_ORG"] == null ? {} : { org: process.env["SENTRY_ORG"] }),
    ...(process.env["SENTRY_PROJECT"] == null ? {} : { project: process.env["SENTRY_PROJECT"] }),
    ...(sentryAuthToken == null || sentryAuthToken === "" ? {} : { authToken: sentryAuthToken }),
    silent: !process.env["CI"],
    webpack: {
      treeshake: {
        removeDebugLogging: process.env["NODE_ENV"] === "production"
      }
    },
    sourcemaps: {
      disable: sentryAuthToken == null || sentryAuthToken === "",
      deleteSourcemapsAfterUpload: true
    }
  });
}
