import type { ExternalCompConnectorConfig } from "./types.js";

function joinJinaUrl(baseUrl: string, targetUrl: string): string {
  const prefix = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${prefix}${targetUrl}`;
}

export function buildJinaReaderUrl(baseUrl: string, targetUrl: string): string {
  return joinJinaUrl(baseUrl, targetUrl);
}

export async function fetchTextWithJinaFallback(input: {
  targetUrl: string;
  config: Pick<ExternalCompConnectorConfig, "fetch" | "jinaReaderBaseUrl">;
}): Promise<{ text: string; status: number; usedJinaFallback: boolean; requestUrl: string }> {
  try {
    const direct = await input.config.fetch(input.targetUrl, {
      method: "GET",
      headers: { accept: "text/html, text/plain;q=0.9" }
    });
    if (direct.ok) {
      return {
        text: await direct.text(),
        status: direct.status,
        usedJinaFallback: false,
        requestUrl: input.targetUrl
      };
    }
  } catch {
    // Fall through to Reader; the connector records the fallback in source metadata.
  }

  const readerUrl = buildJinaReaderUrl(input.config.jinaReaderBaseUrl, input.targetUrl);
  const fallback = await input.config.fetch(readerUrl, {
    method: "GET",
    headers: { accept: "text/plain" }
  });

  if (!fallback.ok) {
    throw new Error(`Jina Reader fallback failed with status ${fallback.status}`);
  }

  return {
    text: await fallback.text(),
    status: fallback.status,
    usedJinaFallback: true,
    requestUrl: readerUrl
  };
}
