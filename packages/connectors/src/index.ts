import type { SourceKind } from "@renaiss/core";

export type ConnectorLogger = {
  info: (fields: Record<string, unknown>, message?: string) => void;
  warn: (fields: Record<string, unknown>, message?: string) => void;
  error: (fields: Record<string, unknown>, message?: string) => void;
};

export type RateLimiter = {
  schedule: <T>(task: () => Promise<T>) => Promise<T>;
};

export type ConnectorContext = {
  runId: string;
  now: Date;
  signal?: AbortSignal;
  logger: ConnectorLogger;
  rateLimiter: RateLimiter;
};

export type ConnectorResult<T> = {
  source: SourceKind;
  sourceUrl: string;
  fetchedAt: string;
  rawRecordId?: string;
  data: T;
  warnings: string[];
};

export type Connector<Input, Output> = {
  readonly name: string;
  fetch(input: Input, context: ConnectorContext): Promise<ConnectorResult<Output>>;
};

export * from "./renaiss/index.js";
