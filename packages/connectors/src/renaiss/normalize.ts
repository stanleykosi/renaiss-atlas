import { extractSerialBigInt, extractSerialDigits, parseCentsUsd, parseWeiUsd } from "@renaiss/core";

import type {
  RenaissConcreteMarketplaceStrategy,
  RenaissDataQualityEvent,
  RenaissNormalizedCard,
  RenaissNormalizedPrice
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

const missingPriceSentinels = new Set(["", "NO-ASK-PRICE", "NO-OFFER-PRICE", "null", "undefined"]);

export function strategyToSource(strategy: RenaissConcreteMarketplaceStrategy) {
  return strategy === "v0" ? "renaiss_marketplace_v0" : "renaiss_trpc_collectible_list";
}

function isRecord(value: unknown): value is UnknownRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return null;
  }

  const raw = String(value).trim();
  return raw.length > 0 ? raw : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = asString(value);
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function pickValue(record: UnknownRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key];
  }
  return undefined;
}

function pickString(record: UnknownRecord, keys: readonly string[]): string | null {
  return asString(pickValue(record, keys));
}

function normalizeSearchText(value: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findAttribute(item: UnknownRecord, names: readonly string[]): string | null {
  const normalizedNames = names.map((name) => normalizeSearchText(name));
  const rawAttributes = pickValue(item, ["attributes", "traits"]);

  if (Array.isArray(rawAttributes)) {
    for (const attribute of rawAttributes) {
      if (!isRecord(attribute)) continue;

      const key = pickString(attribute, ["trait_type", "traitType", "type", "name", "key"]);
      if (key == null || !normalizedNames.includes(normalizeSearchText(key))) continue;

      return asString(pickValue(attribute, ["value", "displayValue"]));
    }
  }

  if (isRecord(rawAttributes)) {
    for (const [key, value] of Object.entries(rawAttributes)) {
      if (normalizedNames.includes(normalizeSearchText(key))) {
        return asString(value);
      }
    }
  }

  return null;
}

function pickNestedString(record: UnknownRecord, path: readonly string[]): string | null {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return asString(current);
}

function parseUsd(value: unknown): string | null {
  const raw = asString(value);
  if (raw == null || missingPriceSentinels.has(raw)) return null;

  const normalized = raw.replace(/[$,\s]/g, "");
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalized)) return null;

  const trimmed = normalized.replace(/^0+(?=\d)/, "");
  return trimmed === "" ? "0" : trimmed;
}

function normalizeYear(value: unknown): number | null {
  const year = asNumber(value);
  if (year == null || year < 1800 || year > 2200) return null;
  return year;
}

function hasRawValue(value: unknown): boolean {
  const raw = asString(value);
  return raw != null && !missingPriceSentinels.has(raw);
}

function createQualityEvent(input: {
  strategy: RenaissConcreteMarketplaceStrategy;
  entityId?: string | null;
  severity: RenaissDataQualityEvent["severity"];
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): RenaissDataQualityEvent {
  return {
    source: strategyToSource(input.strategy),
    entityType: input.entityId == null ? null : "card",
    entityId: input.entityId ?? null,
    severity: input.severity,
    code: input.code,
    message: input.message,
    details: input.details ?? {}
  };
}

function inferListedStatus(item: UnknownRecord, askPriceUsd: string | null): boolean {
  const explicitListed = pickValue(item, ["isListed", "listed", "listedOnly"]);
  if (typeof explicitListed === "boolean") return explicitListed;

  const status = pickString(item, ["status", "listingStatus", "state"]);
  if (status != null) {
    const normalized = normalizeSearchText(status);
    if (normalized.includes("unlisted") || normalized.includes("not listed")) return false;
    if (normalized.includes("listed") || normalized.includes("sale")) return true;
  }

  return askPriceUsd != null;
}

export function normalizeRenaissMarketplaceItem(
  item: unknown,
  options: {
    strategy: RenaissConcreteMarketplaceStrategy;
    observedAt: string;
    sourceUrl: string;
  }
): {
  card: RenaissNormalizedCard | null;
  price: RenaissNormalizedPrice | null;
  dataQualityEvents: RenaissDataQualityEvent[];
  warnings: string[];
} {
  if (!isRecord(item)) {
    const event = createQualityEvent({
      strategy: options.strategy,
      severity: "error",
      code: "renaiss_item_not_object",
      message: "Renaiss marketplace item was not an object."
    });
    return { card: null, price: null, dataQualityEvents: [event], warnings: [event.message] };
  }

  const tokenId = pickString(item, ["tokenId", "token_id", "collectibleTokenId", "id"]);
  if (tokenId == null) {
    const event = createQualityEvent({
      strategy: options.strategy,
      severity: "error",
      code: "renaiss_missing_token_id",
      message: "Renaiss marketplace item did not include a token ID.",
      details: { sourceUrl: options.sourceUrl }
    });
    return { card: null, price: null, dataQualityEvents: [event], warnings: [event.message] };
  }

  const events: RenaissDataQualityEvent[] = [];
  const warnings: string[] = [];

  const askRaw = pickValue(item, ["askPriceInUSDT", "askPriceRaw", "askPrice"]);
  const offerRaw = pickValue(item, ["offerPriceInUSDT", "offerPriceRaw", "offerPrice"]);
  const fmvRaw = pickValue(item, ["fmvPriceInUSD", "fmvRaw", "fmv"]);
  const buybackRaw = pickValue(item, ["buybackBaseValueInUSD", "buybackBaseValueRaw"]);

  const askPriceUsd = parseWeiUsd(askRaw);
  const offerPriceUsd = parseWeiUsd(offerRaw);
  const fmvUsd = parseCentsUsd(fmvRaw);
  const buybackBaseValueUsd = parseCentsUsd(buybackRaw);
  const topOfferUsd = parseUsd(pickValue(item, ["topOffer", "topOfferUsd", "topOfferUSD"]));
  const lastSaleUsd = parseUsd(pickValue(item, ["lastSale", "lastSaleUsd", "lastSaleUSD"]));

  if (hasRawValue(askRaw) && askPriceUsd == null) {
    const event = createQualityEvent({
      strategy: options.strategy,
      entityId: tokenId,
      severity: "warning",
      code: "renaiss_unparsed_ask_price",
      message: "Renaiss ask price could not be parsed as USDT wei.",
      details: { rawValue: askRaw }
    });
    events.push(event);
    warnings.push(event.message);
  }

  if (hasRawValue(fmvRaw) && fmvUsd == null) {
    const event = createQualityEvent({
      strategy: options.strategy,
      entityId: tokenId,
      severity: "warning",
      code: "renaiss_unparsed_fmv_price",
      message: "Renaiss FMV price could not be parsed as USD cents.",
      details: { rawValue: fmvRaw }
    });
    events.push(event);
    warnings.push(event.message);
  }

  const name =
    pickString(item, ["name", "title", "cardName", "collectibleName"]) ?? `Renaiss card ${tokenId}`;
  if (name === `Renaiss card ${tokenId}`) {
    const event = createQualityEvent({
      strategy: options.strategy,
      entityId: tokenId,
      severity: "warning",
      code: "renaiss_missing_name",
      message: "Renaiss marketplace item did not include a card name."
    });
    events.push(event);
    warnings.push(event.message);
  }

  const serial = pickString(item, ["serial", "serialNumber", "certNumber"]) ?? findAttribute(item, ["Serial"]);
  const grader =
    pickString(item, ["grader", "gradingCompany", "gradingCompanyName"]) ??
    findAttribute(item, ["Grader", "Grading Company"]);
  const grade = pickString(item, ["grade", "cardGrade"]) ?? findAttribute(item, ["Grade"]);
  const language = pickString(item, ["language"]) ?? findAttribute(item, ["Language"]);
  const setName = pickString(item, ["setName", "set", "series"]) ?? "";
  const characterName =
    pickString(item, ["pokemonName", "characterName", "character", "subjectName"]) ??
    findAttribute(item, ["Character", "Pokemon"]) ??
    "";
  const cardNumber = pickString(item, ["cardNumber", "number", "collectorNumber"]) ?? "";
  const tcg = pickString(item, ["tcg", "game", "category"]) ?? "";
  const yearValue = pickValue(item, ["year", "releaseYear"]);
  const year = normalizeYear(yearValue);

  if (yearValue != null && year == null) {
    const event = createQualityEvent({
      strategy: options.strategy,
      entityId: tokenId,
      severity: "warning",
      code: "renaiss_unparsed_year",
      message: "Renaiss card year was outside the supported range.",
      details: { rawValue: yearValue }
    });
    events.push(event);
    warnings.push(event.message);
  }

  const isListed = inferListedStatus(item, askPriceUsd);
  if (isListed && askPriceUsd == null) {
    const event = createQualityEvent({
      strategy: options.strategy,
      entityId: tokenId,
      severity: "warning",
      code: "renaiss_listed_without_ask",
      message: "Renaiss item appears listed but does not include a usable ask price."
    });
    events.push(event);
    warnings.push(event.message);
  }

  const card: RenaissNormalizedCard = {
    tokenId,
    itemId: pickString(item, ["itemId", "item_id", "collectibleId"]),
    name,
    normalizedName: normalizeSearchText(name),
    setName,
    normalizedSetName: normalizeSearchText(setName),
    cardNumber,
    characterName,
    normalizedCharacterName: normalizeSearchText(characterName),
    tcg,
    ownerAddress: pickString(item, ["ownerAddress", "walletAddress"]) ?? pickNestedString(item, ["owner", "address"]),
    ownerUsername: pickNestedString(item, ["owner", "username"]) ?? pickString(item, ["ownerUsername"]),
    vaultLocation: pickString(item, ["vaultLocation"]),
    grader,
    grade,
    language,
    year,
    serial,
    serialNum: extractSerialBigInt(serial),
    imageUrl: pickString(item, ["frontImageUrl", "imageUrl", "image", "thumbnailUrl"]),
    status: isListed ? "listed" : "unlisted",
    firstSeenAt: options.observedAt,
    lastSeenAt: options.observedAt,
    metadata: {
      source: strategyToSource(options.strategy),
      sourceUrl: options.sourceUrl,
      serialDigits: extractSerialDigits(serial)
    }
  };

  const price: RenaissNormalizedPrice = {
    tokenId,
    askPriceUsd,
    askPriceRaw: asString(askRaw),
    askPriceRawUnit: "wei_usdt",
    fmvUsd,
    fmvRaw: asString(fmvRaw),
    fmvRawUnit: "usd_cents",
    offerPriceUsd,
    topOfferUsd,
    lastSaleUsd,
    buybackBaseValueUsd,
    isListed,
    source: strategyToSource(options.strategy),
    observedAt: options.observedAt,
    metadata: {
      sourceUrl: options.sourceUrl,
      rawTopOffer: pickValue(item, ["topOffer", "topOfferUsd", "topOfferUSD"]) ?? null,
      rawLastSale: pickValue(item, ["lastSale", "lastSaleUsd", "lastSaleUSD"]) ?? null,
      rawBuybackBaseValue: buybackRaw ?? null
    }
  };

  return { card, price, dataQualityEvents: events, warnings };
}
