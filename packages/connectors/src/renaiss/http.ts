import type { ConnectorContext } from "../index.js";
import type { RenaissMarketplaceConfig } from "./types.js";

const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Request aborted"));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason instanceof Error ? signal.reason : new Error("Request aborted"));
      },
      { once: true }
    );
  });
}

export function createSerialRateLimiter(delayMs: number) {
  let nextAvailableAt = 0;
  let queue = Promise.resolve();

  return {
    schedule<T>(task: () => Promise<T>): Promise<T> {
      queue = queue.catch(() => undefined).then(async () => {
        const now = Date.now();
        const delay = Math.max(0, nextAvailableAt - now);
        await wait(delay);
        nextAvailableAt = Date.now() + delayMs;
      });

      return queue.then(task);
    }
  };
}

export async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  config: Pick<RenaissMarketplaceConfig, "fetch" | "retryAttempts" | "retryBaseDelayMs">,
  context: Pick<ConnectorContext, "signal" | "logger">
): Promise<{ status: number; json: unknown }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.retryAttempts; attempt += 1) {
    try {
      const requestInit = context.signal == null ? init : { ...init, signal: context.signal };
      const response = await config.fetch(url, requestInit);

      if (!response.ok && retryableStatuses.has(response.status) && attempt < config.retryAttempts) {
        context.logger.warn(
          { url, status: response.status, attempt },
          "Renaiss marketplace request returned retryable status"
        );
        await wait(config.retryBaseDelayMs * attempt, context.signal);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Renaiss marketplace request failed with status ${response.status}`);
      }

      return {
        status: response.status,
        json: await response.json()
      };
    } catch (error) {
      lastError = error;
      if (attempt >= config.retryAttempts) break;

      context.logger.warn(
        {
          url,
          attempt,
          error: error instanceof Error ? error.message : String(error)
        },
        "Retrying Renaiss marketplace request"
      );
      await wait(config.retryBaseDelayMs * attempt, context.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
