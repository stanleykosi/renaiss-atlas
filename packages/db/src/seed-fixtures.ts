import {
  actionRecommendations,
  aiMemos,
  bundleItems,
  bundles,
  cardPriceSnapshots,
  cards,
  collectionQuests,
  externalPriceSnapshots,
  intentMatches,
  intents,
  latestCardPrices,
  latestScores,
  packActivities,
  scores,
  sourceRecords,
  walletSnapshots
} from "./schema.js";

export const DEMO_WALLET = "0x1111111111111111111111111111111111111111";

const observedAt = new Date("2026-06-26T12:00:00.000Z");
const staleObservedAt = new Date("2026-06-19T12:00:00.000Z");
const DEMO_MARKET_SOURCE_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_EXTERNAL_SOURCE_ID = "00000000-0000-4000-8000-000000000002";
const DEMO_PACK_SOURCE_ID = "00000000-0000-4000-8000-000000000003";
const DEMO_INTENT_ID = "00000000-0000-4000-8000-000000000301";
const DEMO_SEQUENTIAL_BUNDLE_ID = "00000000-0000-4000-8000-000000000401";
const DEMO_CHARACTER_BUNDLE_ID = "00000000-0000-4000-8000-000000000402";

type DemoPriceSnapshot = typeof cardPriceSnapshots.$inferInsert & {
  id: string;
  tokenId: string;
  isListed: boolean;
  observedAt: Date;
};

type DemoScore = typeof scores.$inferInsert & {
  id: string;
  entityType: string;
  entityId: string;
  scoreType: NonNullable<(typeof scores.$inferInsert)["scoreType"]>;
  scoreValue: string;
  confidence: NonNullable<(typeof scores.$inferInsert)["confidence"]>;
  computedAt: Date;
};

export const demoSourceRecords = [
  {
    id: DEMO_MARKET_SOURCE_ID,
    source: "manual_seed",
    sourceUrl: "https://renaiss-atlas.local/demo/market",
    requestFingerprint: "demo-market-seed",
    responseStatus: 200,
    responseHash: "demo-market-hash",
    rawJson: { label: "mock/demo Renaiss marketplace seed" },
    fetchedAt: observedAt,
    parseStatus: "parsed"
  },
  {
    id: DEMO_EXTERNAL_SOURCE_ID,
    source: "mock",
    sourceUrl: "https://renaiss-atlas.local/demo/external-comps",
    requestFingerprint: "demo-external-comps-seed",
    responseStatus: 200,
    responseHash: "demo-comps-hash",
    rawJson: { label: "mock/demo external comp seed" },
    fetchedAt: observedAt,
    parseStatus: "partial"
  },
  {
    id: DEMO_PACK_SOURCE_ID,
    source: "manual_seed",
    sourceUrl: "https://renaiss-atlas.local/demo/pack-activity",
    requestFingerprint: "demo-pack-seed",
    responseStatus: 200,
    responseHash: "demo-pack-hash",
    rawJson: { label: "mock/demo pack activity seed" },
    fetchedAt: observedAt,
    parseStatus: "parsed"
  }
] satisfies Array<typeof sourceRecords.$inferInsert>;

export const demoCards = [
  {
    tokenId: "demo-card-001",
    itemId: "demo-item-001",
    name: "Pikachu Renaiss Demo PSA 10",
    normalizedName: "pikachu renaiss demo psa 10",
    setName: "Demo Sparks",
    normalizedSetName: "demo sparks",
    cardNumber: "025",
    characterName: "Pikachu",
    normalizedCharacterName: "pikachu",
    tcg: "Pokemon",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "10",
    language: "Japanese",
    year: 2024,
    serial: "PSA12345678",
    serialNum: 12345678n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/pikachu-001.png",
    status: "listed",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "high-confidence liquid card" }
  },
  {
    tokenId: "demo-card-002",
    itemId: "demo-item-002",
    name: "Pikachu Renaiss Demo Adjacent PSA 10",
    normalizedName: "pikachu renaiss demo adjacent psa 10",
    setName: "Demo Sparks",
    normalizedSetName: "demo sparks",
    cardNumber: "026",
    characterName: "Pikachu",
    normalizedCharacterName: "pikachu",
    tcg: "Pokemon",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "10",
    language: "Japanese",
    year: 2024,
    serial: "PSA12345679",
    serialNum: 12345679n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/pikachu-002.png",
    status: "listed",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "sequential cert pair" }
  },
  {
    tokenId: "demo-card-003",
    itemId: "demo-item-003",
    name: "Charizard Renaiss Demo Under FMV",
    normalizedName: "charizard renaiss demo under fmv",
    setName: "Demo Flames",
    normalizedSetName: "demo flames",
    cardNumber: "006",
    characterName: "Charizard",
    normalizedCharacterName: "charizard",
    tcg: "Pokemon",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "9",
    language: "English",
    year: 2023,
    serial: "PSA22345678",
    serialNum: 22345678n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/charizard-003.png",
    status: "listed",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "under-FMV card" }
  },
  {
    tokenId: "demo-card-004",
    itemId: "demo-item-004",
    name: "Luffy Renaiss Demo Comp Mismatch",
    normalizedName: "luffy renaiss demo comp mismatch",
    setName: "Demo Pirates",
    normalizedSetName: "demo pirates",
    cardNumber: "OP-01",
    characterName: "Luffy",
    normalizedCharacterName: "luffy",
    tcg: "One Piece",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "10",
    language: "Japanese",
    year: 2024,
    serial: "PSA32345678",
    serialNum: 32345678n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/luffy-004.png",
    status: "unlisted",
    firstSeenAt: staleObservedAt,
    lastSeenAt: staleObservedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "external comp mismatch" }
  },
  {
    tokenId: "demo-card-005",
    itemId: "demo-item-005",
    name: "Nami Renaiss Demo Intent Match",
    normalizedName: "nami renaiss demo intent match",
    setName: "Demo Pirates",
    normalizedSetName: "demo pirates",
    cardNumber: "OP-02",
    characterName: "Nami",
    normalizedCharacterName: "nami",
    tcg: "One Piece",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "10",
    language: "Japanese",
    year: 2024,
    serial: "PSA42345678",
    serialNum: 42345678n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/nami-005.png",
    status: "unlisted",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "intent match" }
  },
  {
    tokenId: "demo-card-006",
    itemId: "demo-item-006",
    name: "RenaCrypt Epic Pull Demo",
    normalizedName: "renacrypt epic pull demo",
    setName: "RenaCrypt",
    normalizedSetName: "renacrypt",
    cardNumber: "RC-77",
    characterName: "Atlas",
    normalizedCharacterName: "atlas",
    tcg: "Renaiss",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "10",
    language: "English",
    year: 2026,
    serial: "PSA52345678",
    serialNum: 52345678n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/renacrypt-006.png",
    status: "listed",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "pack-origin card" }
  },
  {
    tokenId: "demo-card-007",
    itemId: "demo-item-007",
    name: "OMEGA Tier A Demo",
    normalizedName: "omega tier a demo",
    setName: "OMEGA",
    normalizedSetName: "omega",
    cardNumber: "OM-10",
    characterName: "Omega",
    normalizedCharacterName: "omega",
    tcg: "Renaiss",
    ownerAddress: DEMO_WALLET,
    ownerUsername: "demo-collector",
    grader: "PSA",
    grade: "9",
    language: "English",
    year: 2026,
    serial: "PSA62345678",
    serialNum: 62345678n,
    imageUrl: "https://renaiss-atlas.local/demo/cards/omega-007.png",
    status: "listed",
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    lastSourceRecordId: DEMO_MARKET_SOURCE_ID,
    metadata: { mockData: true, demoCase: "omega pack activity" }
  }
] satisfies Array<typeof cards.$inferInsert>;

export const demoPriceSnapshots: DemoPriceSnapshot[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    tokenId: "demo-card-001",
    askPriceUsd: "140.000000",
    askPriceRaw: "140000000000000000000",
    askPriceRawUnit: "wei_usdt",
    fmvUsd: "150.000000",
    fmvRaw: "15000",
    fmvRawUnit: "usd_cents",
    topOfferUsd: "132.000000",
    isListed: true,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    tokenId: "demo-card-002",
    askPriceUsd: "138.000000",
    fmvUsd: "145.000000",
    topOfferUsd: "120.000000",
    isListed: true,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    tokenId: "demo-card-003",
    askPriceUsd: "210.000000",
    fmvUsd: "300.000000",
    topOfferUsd: "180.000000",
    isListed: true,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    tokenId: "demo-card-004",
    fmvUsd: "90.000000",
    isListed: false,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt: staleObservedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    tokenId: "demo-card-005",
    fmvUsd: "120.000000",
    isListed: false,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    tokenId: "demo-card-006",
    askPriceUsd: "500.000000",
    fmvUsd: "525.000000",
    topOfferUsd: "465.000000",
    isListed: true,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000107",
    tokenId: "demo-card-007",
    askPriceUsd: "250.000000",
    fmvUsd: "260.000000",
    topOfferUsd: "220.000000",
    isListed: true,
    source: "manual_seed",
    sourceRecordId: DEMO_MARKET_SOURCE_ID,
    observedAt
  }
];

export const demoLatestPrices = demoPriceSnapshots.map((snapshot) => ({
  tokenId: snapshot.tokenId,
  priceSnapshotId: snapshot.id,
  askPriceUsd: snapshot.askPriceUsd,
  fmvUsd: snapshot.fmvUsd,
  offerPriceUsd: snapshot.offerPriceUsd,
  topOfferUsd: snapshot.topOfferUsd,
  lastSaleUsd: snapshot.lastSaleUsd,
  buybackBaseValueUsd: snapshot.buybackBaseValueUsd,
  isListed: snapshot.isListed,
  observedAt: snapshot.observedAt,
  updatedAt: observedAt
})) satisfies Array<typeof latestCardPrices.$inferInsert>;

export const demoExternalPrices = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    tokenId: "demo-card-001",
    platform: "mock",
    productTitle: "Pikachu Demo Sparks #025 PSA 10 Japanese",
    productUrl: "https://renaiss-atlas.local/demo/comps/pikachu",
    currency: "USD",
    currentPriceUsd: "152.000000",
    lastSaleUsd: "148.000000",
    averagePriceUsd: "150.000000",
    volume30d: 8,
    gradeMatched: true,
    languageMatched: true,
    cardNumberMatched: true,
    matchConfidence: "92.00",
    matchReasons: ["exact card number", "language match", "grade match"],
    rejected: false,
    sourceRecordId: DEMO_EXTERNAL_SOURCE_ID,
    fetchedAt: observedAt,
    metadata: { mockData: true }
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    tokenId: "demo-card-004",
    platform: "mock",
    productTitle: "Wrong Luffy Parallel English PSA 8",
    productUrl: "https://renaiss-atlas.local/demo/comps/luffy-mismatch",
    currency: "USD",
    currentPriceUsd: "900.000000",
    gradeMatched: false,
    languageMatched: false,
    cardNumberMatched: false,
    matchConfidence: "22.00",
    matchReasons: ["card number mismatch", "language mismatch", "price outside 4x FMV"],
    rejected: true,
    rejectionReason: "Rejected because metadata and price range do not match the Renaiss card.",
    sourceRecordId: DEMO_EXTERNAL_SOURCE_ID,
    fetchedAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof externalPriceSnapshots.$inferInsert>;

export const demoPackActivities = [
  {
    activityId: "demo-pack-renacrypt-001",
    packName: "RenaCrypt Pack",
    packSlug: "renacrypt-pack",
    tier: "Epic",
    fmvUsd: "525.000000",
    psaId: "52345678",
    frontImageUrl: "https://renaiss-atlas.local/demo/cards/renacrypt-006.png",
    pulledAt: observedAt,
    firstSeenAt: observedAt,
    sourceRecordId: DEMO_PACK_SOURCE_ID,
    matchedTokenId: "demo-card-006",
    metadata: { mockData: true, observedIntervalNotOfficialOdds: true }
  },
  {
    activityId: "demo-pack-omega-001",
    packName: "OMEGA",
    packSlug: "omega",
    tier: "Tier A",
    fmvUsd: "260.000000",
    psaId: "62345678",
    frontImageUrl: "https://renaiss-atlas.local/demo/cards/omega-007.png",
    pulledAt: observedAt,
    firstSeenAt: observedAt,
    sourceRecordId: DEMO_PACK_SOURCE_ID,
    matchedTokenId: "demo-card-007",
    metadata: { mockData: true, observedIntervalNotOfficialOdds: true }
  }
] satisfies Array<typeof packActivities.$inferInsert>;

export const demoIntents = [
  {
    id: DEMO_INTENT_ID,
    creatorAlias: "demo-buyer",
    creatorWallet: "0x2222222222222222222222222222222222222222",
    creatorDiscordId: "demo-discord-user",
    intentType: "buy",
    queryText: "Looking for PSA 10 Japanese One Piece cards under $150.",
    tcg: "One Piece",
    language: "Japanese",
    maxPriceUsd: "150.000000",
    requiresSerialAdjacency: false,
    requiresExternalComp: false,
    minLiquidityScore: "40.00",
    status: "active",
    createdAt: observedAt,
    updatedAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof intents.$inferInsert>;

export const demoIntentMatches = [
  {
    id: "00000000-0000-4000-8000-000000000302",
    intentId: DEMO_INTENT_ID,
    tokenId: "demo-card-005",
    matchScore: "86.00",
    confidence: "high",
    reasons: ["TCG match", "language match", "grade match", "price range match"],
    createdAt: observedAt
  }
] satisfies Array<typeof intentMatches.$inferInsert>;

export const demoBundles = [
  {
    id: DEMO_SEQUENTIAL_BUNDLE_ID,
    bundleType: "sequential_cert_pair",
    name: "Demo Pikachu Sequential PSA Pair",
    summary: "Two adjacent PSA cert Pikachu demo cards owned by the demo wallet.",
    score: "88.00",
    confidence: "high",
    reasonJson: {
      reasons: ["Adjacent PSA certs", "Both listed", "Total ask is near total FMV"]
    },
    totalAskUsd: "278.000000",
    totalFmvUsd: "295.000000",
    createdAt: observedAt,
    updatedAt: observedAt,
    metadata: { mockData: true }
  },
  {
    id: DEMO_CHARACTER_BUNDLE_ID,
    bundleType: "same_character",
    name: "Demo Pikachu Same Character Bundle",
    summary: "Same-character collector bundle for demo marketplace flow.",
    score: "76.00",
    confidence: "medium",
    reasonJson: {
      reasons: ["Same character", "High-confidence external comp on one card"]
    },
    totalAskUsd: "278.000000",
    totalFmvUsd: "295.000000",
    createdAt: observedAt,
    updatedAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof bundles.$inferInsert>;

export const demoBundleItems = [
  {
    bundleId: DEMO_SEQUENTIAL_BUNDLE_ID,
    tokenId: "demo-card-001",
    position: 1,
    role: "first_cert"
  },
  {
    bundleId: DEMO_SEQUENTIAL_BUNDLE_ID,
    tokenId: "demo-card-002",
    position: 2,
    role: "adjacent_cert"
  },
  {
    bundleId: DEMO_CHARACTER_BUNDLE_ID,
    tokenId: "demo-card-001",
    position: 1,
    role: "same_character"
  },
  {
    bundleId: DEMO_CHARACTER_BUNDLE_ID,
    tokenId: "demo-card-002",
    position: 2,
    role: "same_character"
  }
] satisfies Array<typeof bundleItems.$inferInsert>;

export const demoScores: DemoScore[] = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    entityType: "card",
    entityId: "demo-card-001",
    scoreType: "liquidity",
    scoreValue: "82.00",
    confidence: "high",
    inputsHash: "demo-liquidity-card-001",
    reasonsJson: ["Top offer is close to ask", "External comp confidence is high"],
    riskFlagsJson: ["mock_data"],
    computedAt: observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    entityType: "card",
    entityId: "demo-card-003",
    scoreType: "deal",
    scoreValue: "74.00",
    confidence: "medium",
    inputsHash: "demo-deal-card-003",
    reasonsJson: ["Ask is below Renaiss FMV"],
    riskFlagsJson: ["mock_data"],
    computedAt: observedAt
  },
  {
    id: "00000000-0000-4000-8000-000000000503",
    entityType: "bundle",
    entityId: DEMO_SEQUENTIAL_BUNDLE_ID,
    scoreType: "bundle",
    scoreValue: "88.00",
    confidence: "high",
    inputsHash: "demo-bundle-score-001",
    reasonsJson: ["Sequential cert relationship"],
    riskFlagsJson: ["mock_data"],
    computedAt: observedAt
  }
] satisfies Array<typeof scores.$inferInsert>;

export const demoLatestScores = demoScores.map((score) => ({
  entityType: score.entityType,
  entityId: score.entityId,
  scoreType: score.scoreType,
  scoreId: score.id,
  scoreValue: score.scoreValue,
  confidence: score.confidence,
  computedAt: score.computedAt
})) satisfies Array<typeof latestScores.$inferInsert>;

export const demoActions = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    subjectType: "wallet",
    subjectId: DEMO_WALLET,
    actionType: "BUNDLE",
    priority: 1,
    title: "Bundle the sequential Pikachu pair",
    reason: "Adjacent PSA certs are both listed and total ask is near total FMV.",
    confidence: "high",
    impact: "liquidity",
    risksJson: ["mock_data"],
    sourceIdsJson: [
      "renaiss:marketplace:demo-card-001:2026-06-26t12-00-00.000z",
      "bundle:00000000-0000-4000-8000-000000000401"
    ],
    ctaJson: { label: "Open bundle", href: "/bundles" },
    createdAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof actionRecommendations.$inferInsert>;

export const demoAiMemos = [
  {
    id: "00000000-0000-4000-8000-000000000701",
    subjectType: "card",
    subjectId: "demo-card-001",
    provider: "deterministic",
    model: "atlas-fallback",
    inputHash: "demo-ai-memo-card-001",
    outputJson: {
      recommendation: "Consider bundling this card with the adjacent PSA cert.",
      evidence: ["High liquidity score", "Adjacent cert is also listed"],
      risks: ["Demo data is mock-labeled"],
      confidence: "high",
      sourcesUsed: ["00000000-0000-4000-8000-000000000001"],
      nextAction: { label: "Open bundle", type: "BUNDLE" },
      disclaimer: "Atlas recommendations are informational and mock data must be verified."
    },
    validationStatus: "fallback",
    sourceIdsJson: ["00000000-0000-4000-8000-000000000001"],
    createdAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof aiMemos.$inferInsert>;

export const demoWalletSnapshots = [
  {
    id: "00000000-0000-4000-8000-000000000801",
    walletAddress: DEMO_WALLET,
    totalCards: 7,
    listedCards: 5,
    unlistedCards: 2,
    totalFmvUsd: "1595.000000",
    totalAskUsd: "1238.000000",
    avgLiquidityScore: "68.00",
    highConfidenceCompRatio: "0.50",
    staleDataRatio: "0.14",
    computedAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof walletSnapshots.$inferInsert>;

export const demoQuests = [
  {
    id: "00000000-0000-4000-8000-000000000901",
    title: "Complete a sequential PSA pair",
    description: "Find or bundle two adjacent PSA cert cards under a defensible FMV range.",
    questType: "bundle",
    rulesJson: {
      requiresBundleType: "sequential_cert_pair",
      mockData: true
    },
    rewardLabel: "Demo quest badge",
    startsAt: observedAt,
    status: "active",
    createdAt: observedAt,
    metadata: { mockData: true }
  }
] satisfies Array<typeof collectionQuests.$inferInsert>;
