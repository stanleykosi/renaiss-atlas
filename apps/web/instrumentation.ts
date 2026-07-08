import type { Instrumentation } from "next";

type SentryModule = typeof import("@sentry/nextjs");

function shouldUseSentry(): boolean {
  const dsn = process.env["SENTRY_DSN"] ?? process.env["NEXT_PUBLIC_SENTRY_DSN"];
  return process.env.NODE_ENV === "production" && dsn != null && dsn.trim().length > 0;
}

async function importSentry(): Promise<SentryModule | null> {
  try {
    return await import("@sentry/nextjs");
  } catch {
    return null;
  }
}

export async function register() {
  if (!shouldUseSentry() || process.env["NEXT_RUNTIME"] !== "nodejs") {
    return;
  }

  const Sentry = await importSentry();
  Sentry?.init({
    dsn: process.env["SENTRY_DSN"] ?? process.env["NEXT_PUBLIC_SENTRY_DSN"],
    environment: process.env["SENTRY_ENVIRONMENT"] ?? process.env["VERCEL_ENV"] ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    enableLogs: true
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!shouldUseSentry()) {
    return;
  }

  const Sentry = await importSentry();
  Sentry?.captureRequestError(error, request, context);
};
