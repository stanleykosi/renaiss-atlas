import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

function shouldUseSentry(): boolean {
  const dsn = process.env["SENTRY_DSN"] ?? process.env["NEXT_PUBLIC_SENTRY_DSN"];
  return process.env.NODE_ENV === "production" && dsn != null && dsn.trim().length > 0;
}

export function register() {
  if (!shouldUseSentry() || process.env["NEXT_RUNTIME"] !== "nodejs") {
    return;
  }

  Sentry.init({
    dsn: process.env["SENTRY_DSN"] ?? process.env["NEXT_PUBLIC_SENTRY_DSN"],
    environment:
      process.env["SENTRY_ENVIRONMENT"] ?? process.env["VERCEL_ENV"] ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    enableLogs: true
  });
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  if (!shouldUseSentry()) {
    return;
  }

  Sentry.captureRequestError(error, request, context);
};
