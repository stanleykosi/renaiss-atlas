import { z } from "zod";

import type { Connector, ConnectorContext, ConnectorResult } from "../index.js";
import { fixtureExternalCompCandidates } from "./fixtures.js";
import { fetchTextWithJinaFallback } from "./jina.js";
import { normalizeExternalCompCandidate } from "./match.js";
import { parseMarkdownCompCandidates } from "./parsers.js";
import { generateExternalCompSearchTerms } from "./search-terms.js";
import type {
  ExternalCompCandidate,
  ExternalCompConnectorConfig,
  ExternalCompConnectorInput,
  ExternalCompPage,
  ExternalCompSyncData
} from "./types.js";

const PriceChartingApiResponseSchema = z.object({
  status: z.string().optional(),
  products: z.array(z.record(z.unknown())).default([])
});

const defaultConfig: ExternalCompConnectorConfig = {
  platform: "pricecharting",
  liveEnabled: false,
  baseUrl: "https://www.pricecharting.com/search-products",
  jinaReaderBaseUrl: "https://r.jina.ai/",
  priceChartingApiUrl: "https://www.pricecharting.com/api/products",
  rateLimitMs: 750,
  retryAttempts: 3,
  retryBaseDelayMs: 500,
  fetch
};

function mergeConfig(baseConfig: Partial<ExternalCompConnectorConfig>): ExternalCompConnectorConfig {
  return {
    ...defaultConfig,
    ...baseConfig,
    platform: "pricecharting",
    fetch: baseConfig.fetch ?? defaultConfig.fetch,
    retryBaseDelayMs: baseConfig.retryBaseDelayMs ?? defaultConfig.retryBaseDelayMs
  };
}

function searchUrl(baseUrl: string, searchTerm: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("type", "prices");
  url.searchParams.set("q", searchTerm);
  return url.toString();
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function apiProductCandidate(product: Record<string, unknown>, searchTerm: string): ExternalCompCandidate {
  const title =
    asString(product["product-name"]) ??
    asString(product["productName"]) ??
    asString(product["name"]) ??
    searchTerm;
  const productId = asString(product["id"]) ?? asString(product["product-id"]) ?? title;
  const gradedPrice =
    asNumber(product["graded-price"]) ??
    asNumber(product["manual-only-price"]) ??
    asNumber(product["loose-price"]) ??
    asNumber(product["price"]);

  return {
    externalId: `pricecharting:${productId}`,
    platform: "pricecharting",
    productTitle: title,
    productUrl: `https://www.pricecharting.com/game/${encodeURIComponent(productId)}`,
    currency: "USD",
    currentPrice: gradedPrice,
    averagePrice: gradedPrice,
    volume30d: asNumber(product["sales-volume"]) ?? null,
    grade: asString(product["grade"]) ?? null,
    language: asString(product["language"]) ?? null,
    cardNumber: asString(product["number"]) ?? asString(product["card-number"]),
    raw: product
  };
}

async function fetchApiCandidates(input: {
  config: ExternalCompConnectorConfig;
  searchTerm: string;
  context: ConnectorContext;
}) {
  if (input.config.priceChartingApiToken == null || input.config.priceChartingApiToken.length === 0) {
    return null;
  }

  const apiUrl = new URL(input.config.priceChartingApiUrl ?? defaultConfig.priceChartingApiUrl ?? "");
  apiUrl.searchParams.set("t", input.config.priceChartingApiToken);
  apiUrl.searchParams.set("q", input.searchTerm);
  const response = await input.context.rateLimiter.schedule(() =>
    input.config.fetch(apiUrl, { method: "GET", headers: { accept: "application/json" } })
  );

  if (!response.ok) return null;

  const parsed = PriceChartingApiResponseSchema.parse(await response.json());
  return {
    requestUrl: apiUrl.toString(),
    status: response.status,
    rawJson: parsed,
    candidates: parsed.products.map((product) => apiProductCandidate(product, input.searchTerm))
  };
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
      requestUrl: "fixture://pricecharting/search",
      status: 200,
      rawJson: { fixture: true, searchTerm: input.searchTerm },
      rawTextExcerpt: null,
      usedJinaFallback: false,
      candidates: null
    };
  }

  const apiCandidates = await fetchApiCandidates(input);
  if (apiCandidates != null && apiCandidates.candidates.length > 0) {
    return {
      sourceUrl: targetUrl,
      requestUrl: apiCandidates.requestUrl,
      status: apiCandidates.status,
      rawJson: apiCandidates.rawJson,
      rawTextExcerpt: null,
      usedJinaFallback: false,
      candidates: apiCandidates.candidates
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
      platform: "pricecharting",
      productUrl: targetUrl
    })
  };
}

export function createPriceChartingConnector(
  baseConfig: Partial<ExternalCompConnectorConfig> = {}
): Connector<ExternalCompConnectorInput, ExternalCompSyncData> {
  return {
    name: "pricecharting-external-comps",
    async fetch(input: ExternalCompConnectorInput, context: ConnectorContext): Promise<ConnectorResult<ExternalCompSyncData>> {
      const config = mergeConfig(baseConfig);
      const pages: ExternalCompPage[] = [];

      for (const card of input.cards) {
        const searchTerm = generateExternalCompSearchTerms(card)[0] ?? card.name;
        const fetchedAt = context.now.toISOString();
        const fetched = await fetchCandidates({ config, searchTerm, context });
        const candidates = fetched.candidates ?? fixtureExternalCompCandidates(card, "pricecharting");
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
            ? ["PriceCharting search returned no parseable comp candidates."]
            : [];

        pages.push({
          source: "pricecharting",
          sourceUrl: fetched.sourceUrl,
          requestUrl: fetched.requestUrl,
          responseStatus: fetched.status,
          platform: "pricecharting",
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
                    source: "pricecharting",
                    entityType: "card",
                    entityId: card.tokenId,
                    severity: "warning",
                    code: "pricecharting_no_candidates",
                    message: "PriceCharting search returned no parseable comp candidates.",
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
        source: "pricecharting",
        sourceUrl: config.baseUrl,
        fetchedAt: context.now.toISOString(),
        data,
        warnings: data.warnings
      };
    }
  };
}
