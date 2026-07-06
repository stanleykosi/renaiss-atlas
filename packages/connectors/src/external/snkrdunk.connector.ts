import type { Connector, ConnectorContext, ConnectorResult } from "../index.js";
import { fixtureExternalCompCandidates } from "./fixtures.js";
import { normalizeExternalCompCandidate } from "./match.js";
import { parseMarkdownCompCandidates } from "./parsers.js";
import { generateExternalCompSearchTerms } from "./search-terms.js";
import type {
  ExternalCompConnectorConfig,
  ExternalCompConnectorInput,
  ExternalCompPage,
  ExternalCompSyncData
} from "./types.js";
import { fetchTextWithJinaFallback } from "./jina.js";

const defaultConfig: ExternalCompConnectorConfig = {
  platform: "snkrdunk",
  liveEnabled: false,
  baseUrl: "https://snkrdunk.com/en/search/result",
  jinaReaderBaseUrl: "https://r.jina.ai/",
  rateLimitMs: 750,
  retryAttempts: 3,
  retryBaseDelayMs: 500,
  fetch
};

function mergeConfig(baseConfig: Partial<ExternalCompConnectorConfig>): ExternalCompConnectorConfig {
  return {
    ...defaultConfig,
    ...baseConfig,
    platform: "snkrdunk",
    fetch: baseConfig.fetch ?? defaultConfig.fetch,
    retryBaseDelayMs: baseConfig.retryBaseDelayMs ?? defaultConfig.retryBaseDelayMs
  };
}

function searchUrl(baseUrl: string, searchTerm: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("keyword", searchTerm);
  return url.toString();
}

function rawWithSearchTerm(raw: unknown, searchTerm: string): Record<string, unknown> {
  return raw != null && typeof raw === "object" && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>), searchTerm }
    : { raw, searchTerm };
}

async function fetchCandidates(input: {
  config: ExternalCompConnectorConfig;
  searchTerm: string;
  context: ConnectorContext;
}) {
  const targetUrl = searchUrl(input.config.baseUrl, input.searchTerm);
  if (!input.config.liveEnabled) {
    return {
      sourceUrl: targetUrl,
      requestUrl: "fixture://snkrdunk/search",
      status: 200,
      rawJson: { fixture: true, searchTerm: input.searchTerm },
      rawTextExcerpt: null,
      usedJinaFallback: false,
      candidates: null
    };
  }

  const textResult = await input.context.rateLimiter.schedule(() =>
    fetchTextWithJinaFallback({
      targetUrl,
      config: input.config
    })
  );

  return {
    sourceUrl: targetUrl,
    requestUrl: textResult.requestUrl,
    status: textResult.status,
    rawJson: undefined,
    rawTextExcerpt: textResult.text.slice(0, 20_000),
    usedJinaFallback: textResult.usedJinaFallback,
    candidates: parseMarkdownCompCandidates({
      text: textResult.text,
      platform: "snkrdunk",
      productUrl: targetUrl
    })
  };
}

export function createSnkrdunkConnector(
  baseConfig: Partial<ExternalCompConnectorConfig> = {}
): Connector<ExternalCompConnectorInput, ExternalCompSyncData> {
  return {
    name: "snkrdunk-external-comps",
    async fetch(input: ExternalCompConnectorInput, context: ConnectorContext): Promise<ConnectorResult<ExternalCompSyncData>> {
      const config = mergeConfig(baseConfig);
      const pages: ExternalCompPage[] = [];

      for (const card of input.cards) {
        const searchTerm = generateExternalCompSearchTerms(card)[0] ?? card.name;
        const fetchedAt = context.now.toISOString();
        const fetched = await fetchCandidates({ config, searchTerm, context });
        const candidates =
          fetched.candidates ??
          fixtureExternalCompCandidates(card, "snkrdunk").map((candidate) => ({
            ...candidate,
            raw: rawWithSearchTerm(candidate.raw, searchTerm)
          }));
        const snapshots = candidates.map((candidate) =>
          normalizeExternalCompCandidate({
            card,
            candidate,
            exchangeRates: input.exchangeRates,
            fetchedAt,
            searchTerm,
            live: config.liveEnabled
          })
        );
        const warnings =
          config.liveEnabled && candidates.length === 0
            ? ["SNKRDUNK search returned no parseable comp candidates."]
            : [];

        pages.push({
          source: "snkrdunk",
          sourceUrl: fetched.sourceUrl,
          requestUrl: fetched.requestUrl,
          responseStatus: fetched.status,
          platform: "snkrdunk",
          tokenId: card.tokenId,
          searchTerm,
          fetchedAt,
          rawJson: fetched.rawJson,
          rawTextExcerpt: fetched.rawTextExcerpt,
          candidates,
          snapshots,
          dataQualityEvents:
            warnings.length === 0
              ? []
              : [
                  {
                    source: "snkrdunk",
                    entityType: "card",
                    entityId: card.tokenId,
                    severity: "warning",
                    code: "snkrdunk_no_candidates",
                    message: "SNKRDUNK search returned no parseable comp candidates.",
                    details: { searchTerm }
                  }
                ],
          warnings,
          usedJinaFallback: fetched.usedJinaFallback,
          live: config.liveEnabled
        });
      }

      const data: ExternalCompSyncData = {
        pages,
        snapshots: pages.flatMap((page) => page.snapshots),
        dataQualityEvents: pages.flatMap((page) => page.dataQualityEvents),
        warnings: pages.flatMap((page) => page.warnings),
        exchangeRates: input.exchangeRates,
        live: config.liveEnabled
      };

      return {
        source: "snkrdunk",
        sourceUrl: config.baseUrl,
        fetchedAt: context.now.toISOString(),
        data,
        warnings: data.warnings
      };
    }
  };
}
