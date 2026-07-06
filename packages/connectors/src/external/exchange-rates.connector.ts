import { z } from "zod";

import type { Connector, ConnectorContext, ConnectorResult } from "../index.js";
import type { ExchangeRateTable, ExternalCompFetch } from "./types.js";

const ExchangeRateResponseSchema = z.object({
  base_code: z.string().optional(),
  base: z.string().optional(),
  rates: z.record(z.number().positive())
});

const fixtureRates: ExchangeRateTable = {
  baseCurrency: "USD",
  ratesPerUsd: {
    USD: 1,
    JPY: 147,
    EUR: 0.92,
    GBP: 0.79
  },
  fetchedAt: "2026-07-06T00:00:00.000Z",
  source: "exchange_rates",
  sourceUrl: "fixture://exchange-rates/usd",
  live: false
};

export type ExchangeRateConnectorConfig = {
  liveEnabled?: boolean;
  url?: string;
  fetch?: ExternalCompFetch;
};

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function convertToUsd(
  amount: number | null | undefined,
  currency: string,
  exchangeRates: ExchangeRateTable
): string | null {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return null;
  const normalized = normalizeCurrency(currency);
  if (normalized === "USD") return amount.toFixed(2);
  const rate = exchangeRates.ratesPerUsd[normalized];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return (amount / rate).toFixed(2);
}

export function createExchangeRateConnector(
  baseConfig: ExchangeRateConnectorConfig = {}
): Connector<Record<string, never>, ExchangeRateTable> {
  return {
    name: "exchange-rates",
    async fetch(_input: Record<string, never>, context: ConnectorContext): Promise<ConnectorResult<ExchangeRateTable>> {
      if (baseConfig.liveEnabled !== true) {
        return {
          source: "exchange_rates",
          sourceUrl: fixtureRates.sourceUrl,
          fetchedAt: context.now.toISOString(),
          data: {
            ...fixtureRates,
            fetchedAt: context.now.toISOString()
          },
          warnings: ["Using fixture exchange rates. Live mode is disabled."]
        };
      }

      const url = baseConfig.url ?? "https://open.er-api.com/v6/latest/USD";
      const fetchImpl = baseConfig.fetch ?? fetch;
      const response = await context.rateLimiter.schedule(() =>
        fetchImpl(url, { method: "GET", headers: { accept: "application/json" } })
      );

      if (!response.ok) {
        throw new Error(`Exchange-rate request failed with status ${response.status}`);
      }

      const parsed = ExchangeRateResponseSchema.parse(await response.json());
      const base = normalizeCurrency(parsed.base_code ?? parsed.base ?? "USD");
      if (base !== "USD") {
        throw new Error(`Exchange-rate connector expected USD base, received ${base}.`);
      }

      return {
        source: "exchange_rates",
        sourceUrl: url,
        fetchedAt: context.now.toISOString(),
        data: {
          baseCurrency: "USD",
          ratesPerUsd: { ...parsed.rates, USD: 1 },
          fetchedAt: context.now.toISOString(),
          source: "exchange_rates",
          sourceUrl: url,
          live: true
        },
        warnings: []
      };
    }
  };
}
