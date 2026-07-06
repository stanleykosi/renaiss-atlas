import { hashPayload } from "@renaiss/core";
import {
  createAtlasRepositories,
  type AtlasDb,
  type NewDataQualityEvent,
  type NewExternalPriceSnapshot,
  type NewSourceRecord
} from "@renaiss/db";

import type {
  ExternalCompPage,
  ExternalCompPersistResult,
  ExternalCompSyncData,
  ExternalDataQualityEvent,
  NormalizedExternalCompSnapshot
} from "./types.js";

function parseIsoDate(value: string): Date {
  return new Date(value);
}

function sourceRecordForPage(page: ExternalCompPage, syncRunId?: string): NewSourceRecord {
  const hasError = page.dataQualityEvents.some((event) => event.severity === "error");

  return {
    source: page.source,
    sourceUrl: page.requestUrl,
    requestFingerprint: hashPayload({
      source: page.source,
      tokenId: page.tokenId,
      searchTerm: page.searchTerm,
      requestUrl: page.requestUrl
    }),
    responseStatus: page.responseStatus,
    responseHash: hashPayload(page.rawJson ?? page.rawTextExcerpt ?? page.candidates),
    rawJson: page.rawJson,
    rawTextExcerpt: page.rawTextExcerpt ?? null,
    fetchedAt: parseIsoDate(page.fetchedAt),
    parseStatus: hasError ? "partial" : "parsed",
    syncRunId
  };
}

function snapshotToDbInsert(
  snapshot: NormalizedExternalCompSnapshot,
  sourceRecordId: string
): NewExternalPriceSnapshot {
  return {
    tokenId: snapshot.tokenId,
    platform: snapshot.platform,
    productTitle: snapshot.productTitle ?? null,
    productUrl: snapshot.productUrl ?? null,
    currency: snapshot.currency,
    currentPriceUsd: snapshot.currentPriceUsd ?? null,
    lastSaleUsd: snapshot.lastSaleUsd ?? null,
    averagePriceUsd: snapshot.averagePriceUsd ?? null,
    volume30d: snapshot.volume30d ?? null,
    gradeMatched: snapshot.gradeMatched ?? null,
    languageMatched: snapshot.languageMatched ?? null,
    cardNumberMatched: snapshot.cardNumberMatched ?? null,
    matchConfidence: snapshot.matchConfidence,
    matchReasons: snapshot.matchReasons,
    rejected: snapshot.rejected,
    rejectionReason: snapshot.rejectionReason ?? null,
    sourceRecordId,
    fetchedAt: parseIsoDate(snapshot.fetchedAt),
    metadata: snapshot.metadata
  };
}

function dataQualityEventToDbInsert(
  event: ExternalDataQualityEvent,
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

export async function persistExternalCompSync(
  db: AtlasDb,
  data: ExternalCompSyncData,
  options: { syncRunId?: string } = {}
): Promise<ExternalCompPersistResult> {
  const repos = createAtlasRepositories(db);
  const result: ExternalCompPersistResult = {
    sourceRecords: 0,
    externalPriceSnapshots: 0,
    dataQualityEvents: 0
  };
  const sourceRecordByPage = new Map<ExternalCompPage, string>();

  for (const page of data.pages) {
    const sourceRecord = await repos.sourceRecords.create(sourceRecordForPage(page, options.syncRunId));
    if (sourceRecord == null) {
      throw new Error("Failed to persist external comp source record.");
    }

    result.sourceRecords += 1;
    sourceRecordByPage.set(page, sourceRecord.id);
  }

  for (const page of data.pages) {
    const sourceRecordId = sourceRecordByPage.get(page);
    if (sourceRecordId == null) continue;

    for (const snapshot of page.snapshots) {
      const saved = await repos.externalPrices.create(snapshotToDbInsert(snapshot, sourceRecordId));
      if (saved == null) continue;
      result.externalPriceSnapshots += 1;
    }
  }

  for (const event of data.dataQualityEvents) {
    await repos.dataQualityEvents.create(dataQualityEventToDbInsert(event, options.syncRunId));
    result.dataQualityEvents += 1;
  }

  return result;
}
