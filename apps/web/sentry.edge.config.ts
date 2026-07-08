import * as Sentry from "@sentry/nextjs";

const dsn = process.env["SENTRY_DSN"] ?? process.env["NEXT_PUBLIC_SENTRY_DSN"];

if (process.env["NODE_ENV"] === "production" && dsn != null && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: process.env["SENTRY_ENVIRONMENT"] ?? process.env["VERCEL_ENV"] ?? process.env["NODE_ENV"],
    tracesSampleRate: 0.1,
    enableLogs: true
  });
}
