import { hashPayload } from "@renaiss/core";
import {
  createAtlasRepositories,
  type AtlasDb,
  type NewCard,
  type NewCardPriceSnapshot,
  type NewDataQualityEvent,
  type NewSourceRecord
} from "@renaiss/db";

import type {
  RenaissMarketplacePage,
  RenaissMarketplacePersistResult,
  RenaissMarketplaceSyncData
} from "./types.js";

function parseIsoDate(value: string): Date {
  return new Date(value);
}

function sourceRecordForPage(
  page: RenaissMarketplacePage,
  syncRunId?: string
): NewSourceRecord {
  const hasError = page.dataQualityEvents.some((event) => event.severity === "error");

  return {
    source: page.source,
    sourceUrl: page.requestUrl,
    requestFingerprint: hashPayload({
      source: page.source,
      offset: page.offset,
      limit: page.limit,
      requestUrl: page.requestUrl
    }),
    responseStatus: page.responseStatus,
    responseHash: hashPayload(page.raw),
    rawJson: page.raw,
    fetchedAt: parseIsoDate(page.fetchedAt),
    parseStatus: hasError ? "partial" : "parsed",
    syncRunId
  };
}

function cardToDbInsert(card: RenaissMarketplacePage["cards"][number], sourceRecordId: string): NewCard {
  return {
    tokenId: card.tokenId,
    itemId: card.itemId ?? null,
    name: card.name,
    normalizedName: card.normalizedName,
    setName: card.setName,
    normalizedSetName: card.normalizedSetName,
    cardNumber: card.cardNumber,
    characterName: card.characterName,
    normalizedCharacterName: card.normalizedCharacterName,
    tcg: card.tcg,
    ownerAddress: card.ownerAddress ?? null,
    ownerUsername: card.ownerUsername ?? null,
    vaultLocation: card.vaultLocation ?? null,
    grader: card.grader ?? null,
    grade: card.grade ?? null,
    language: card.language ?? null,
    year: card.year ?? null,
    serial: card.serial ?? null,
    serialNum: card.serialNum ?? null,
    imageUrl: card.imageUrl ?? null,
    status: card.status,
    firstSeenAt: parseIsoDate(card.firstSeenAt),
    lastSeenAt: parseIsoDate(card.lastSeenAt),
    lastSourceRecordId: sourceRecordId,
    metadata: card.metadata
  };
}

function priceToDbInsert(
  price: RenaissMarketplacePage["prices"][number],
  sourceRecordId: string
): NewCardPriceSnapshot {
  return {
    tokenId: price.tokenId,
    askPriceUsd: price.askPriceUsd ?? null,
    askPriceRaw: price.askPriceRaw ?? null,
    askPriceRawUnit: price.askPriceRawUnit ?? null,
    fmvUsd: price.fmvUsd ?? null,
    fmvRaw: price.fmvRaw ?? null,
    fmvRawUnit: price.fmvRawUnit ?? null,
    offerPriceUsd: price.offerPriceUsd ?? null,
    topOfferUsd: price.topOfferUsd ?? null,
    lastSaleUsd: price.lastSaleUsd ?? null,
    buybackBaseValueUsd: price.buybackBaseValueUsd ?? null,
    isListed: price.isListed,
    source: price.source,
    sourceRecordId,
    observedAt: parseIsoDate(price.observedAt),
    metadata: price.metadata
  };
}

function dataQualityEventToDbInsert(
  event: RenaissMarketplacePage["dataQualityEvents"][number],
  syncRunId?: string
): NewDataQualityEvent {
  return {
    source: event.source,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    severity: event.severity,
    code: event.code,
    message: event.message,
    details: {
      ...event.details,
      syncRunId: syncRunId ?? null
    }
  };
}

export async function persistRenaissMarketplaceSync(
  db: AtlasDb,
  data: RenaissMarketplaceSyncData,
  options: { syncRunId?: string } = {}
): Promise<RenaissMarketplacePersistResult> {
  const repos = createAtlasRepositories(db);
  const result: RenaissMarketplacePersistResult = {
    sourceRecords: 0,
    cards: 0,
    priceSnapshots: 0,
    latestPrices: 0,
    dataQualityEvents: 0
  };

  for (const page of data.pages) {
    const sourceRecord = await repos.sourceRecords.create(
      sourceRecordForPage(page, options.syncRunId)
    );

    if (sourceRecord == null) {
      throw new Error("Failed to persist Renaiss source record.");
    }

    result.sourceRecords += 1;

    for (const card of page.cards) {
      await repos.cards.upsert(cardToDbInsert(card, sourceRecord.id));
      result.cards += 1;
    }

    for (const price of page.prices) {
      const snapshot = await repos.priceSnapshots.create(priceToDbInsert(price, sourceRecord.id));
      if (snapshot == null) continue;

      result.priceSnapshots += 1;
      await repos.priceSnapshots.setLatestFromSnapshot(snapshot);
      result.latestPrices += 1;
    }

    for (const event of page.dataQualityEvents) {
      await repos.dataQualityEvents.create(dataQualityEventToDbInsert(event, options.syncRunId));
      result.dataQualityEvents += 1;
    }
  }

  return result;
}
