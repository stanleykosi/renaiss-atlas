import { convertToUsd } from "./exchange-rates.connector.js";
import type {
  ExchangeRateTable,
  ExternalCompCandidate,
  ExternalCompCardInput,
  NormalizedExternalCompSnapshot
} from "./types.js";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length > 1)
  );
}

function comparableCardNumber(value: string | null | undefined): string {
  return normalizeText(value).replace(/^#/, "");
}

function expectedTokens(card: ExternalCompCardInput): Set<string> {
  return tokenSet(
    [
      card.characterName,
      card.setName,
      card.cardNumber,
      card.tcg,
      card.grader,
      card.grade == null ? null : `psa ${card.grade}`,
      card.language
    ]
      .filter((value): value is string => value != null && value.trim().length > 0)
      .join(" ")
  );
}

function titleSimilarity(card: ExternalCompCardInput, title: string): number {
  const expected = expectedTokens(card);
  const actual = tokenSet(title);
  if (expected.size === 0) return 0;
  const hits = [...expected].filter((token) => actual.has(token)).length;
  return hits / expected.size;
}

function matchBoolean(expected: string | null | undefined, candidate: string | null | undefined): boolean | null {
  const normalizedExpected = normalizeText(expected);
  const normalizedCandidate = normalizeText(candidate);
  if (normalizedExpected.length === 0 || normalizedCandidate.length === 0) return null;
  return normalizedExpected === normalizedCandidate || normalizedCandidate.includes(normalizedExpected);
}

function matchGrade(card: ExternalCompCardInput, candidate: ExternalCompCandidate): boolean | null {
  const grade = normalizeText(card.grade);
  if (grade.length === 0) return null;
  const grader = normalizeText(card.grader ?? "PSA");
  const candidateGrade = normalizeText(candidate.grade ?? candidate.productTitle);
  if (candidateGrade.length === 0) return null;
  return candidateGrade.includes(grade) && (grader.length === 0 || candidateGrade.includes(grader));
}

function matchLanguage(card: ExternalCompCardInput, candidate: ExternalCompCandidate): boolean | null {
  const direct = matchBoolean(card.language, candidate.language);
  if (direct != null) return direct;
  const expected = normalizeText(card.language);
  if (expected.length === 0) return null;
  const title = normalizeText(candidate.productTitle);
  if (title.includes("japanese") || title.includes("english")) {
    return title.includes(expected);
  }
  return null;
}

function matchCardNumber(card: ExternalCompCardInput, candidate: ExternalCompCandidate): boolean | null {
  const expected = comparableCardNumber(card.cardNumber);
  if (expected.length === 0) return null;
  const direct = comparableCardNumber(candidate.cardNumber);
  if (direct.length > 0) return direct === expected;
  const title = normalizeText(candidate.productTitle).replaceAll("#", "");
  return title.split(" ").includes(expected);
}

function firstUsdPrice(candidate: {
  currentPriceUsd: string | null;
  averagePriceUsd: string | null;
  lastSaleUsd: string | null;
}): number | null {
  const value = candidate.currentPriceUsd ?? candidate.averagePriceUsd ?? candidate.lastSaleUsd;
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function priceRatio(value: number | null, fmvUsd: number | null | undefined): number | null {
  if (value == null || fmvUsd == null || !Number.isFinite(fmvUsd) || fmvUsd <= 0) return null;
  return value / fmvUsd;
}

function confidenceLabel(value: boolean | null, positive: string, negative: string, unknown: string) {
  if (value === true) return positive;
  if (value === false) return negative;
  return unknown;
}

export function normalizeExternalCompCandidate(input: {
  card: ExternalCompCardInput;
  candidate: ExternalCompCandidate;
  exchangeRates: ExchangeRateTable;
  fetchedAt: string;
  searchTerm: string;
  live: boolean;
}): NormalizedExternalCompSnapshot {
  const currentPriceUsd = convertToUsd(
    input.candidate.currentPrice ?? null,
    input.candidate.currency,
    input.exchangeRates
  );
  const averagePriceUsd = convertToUsd(
    input.candidate.averagePrice ?? null,
    input.candidate.currency,
    input.exchangeRates
  );
  const lastSaleUsd = convertToUsd(
    input.candidate.lastSale ?? null,
    input.candidate.currency,
    input.exchangeRates
  );
  const usablePrice = firstUsdPrice({ currentPriceUsd, averagePriceUsd, lastSaleUsd });
  const ratio = priceRatio(usablePrice, input.card.fmvUsd);
  const gradeMatched = matchGrade(input.card, input.candidate);
  const languageMatched = matchLanguage(input.card, input.candidate);
  const cardNumberMatched = matchCardNumber(input.card, input.candidate);
  const similarity = titleSimilarity(input.card, input.candidate.productTitle);
  const rejectionReasons: string[] = [];
  const matchReasons = [
    confidenceLabel(cardNumberMatched, "card number match", "card number mismatch", "card number unknown"),
    confidenceLabel(languageMatched, "language match", "language mismatch", "language unknown"),
    confidenceLabel(gradeMatched, "grade match", "grade mismatch", "grade unknown"),
    `title similarity ${Math.round(similarity * 100)}%`
  ];

  let confidence = similarity * 25 + 20;
  if (cardNumberMatched === true) confidence += 25;
  if (cardNumberMatched === false) {
    confidence -= 30;
    rejectionReasons.push("card number mismatch");
  }
  if (languageMatched === true) confidence += 15;
  if (languageMatched === false) {
    confidence -= 15;
    rejectionReasons.push("language mismatch");
  }
  if (gradeMatched === true) confidence += 20;
  if (gradeMatched === false) {
    confidence -= 20;
    rejectionReasons.push("grade mismatch");
  }
  if (usablePrice == null) {
    confidence -= 35;
    rejectionReasons.push("missing usable price");
  } else {
    confidence += 15;
  }
  if (ratio != null && (ratio < 0.25 || ratio > 4)) {
    confidence -= 35;
    rejectionReasons.push("price outside 0.25x-4x Renaiss FMV");
  }
  if (similarity < 0.2) {
    confidence -= 25;
    rejectionReasons.push("weak title similarity");
  }

  const matchConfidence = Math.max(0, Math.min(100, Number(confidence.toFixed(2))));
  if (matchConfidence < 45) rejectionReasons.push("low match confidence");

  return {
    tokenId: input.card.tokenId,
    platform: input.candidate.platform,
    productTitle: input.candidate.productTitle,
    productUrl: input.candidate.productUrl ?? null,
    currency: "USD",
    currentPriceUsd,
    lastSaleUsd,
    averagePriceUsd,
    volume30d: input.candidate.volume30d ?? null,
    gradeMatched,
    languageMatched,
    cardNumberMatched,
    matchConfidence: matchConfidence.toFixed(2),
    matchReasons: [...new Set(matchReasons)],
    rejected: rejectionReasons.length > 0,
    rejectionReason:
      rejectionReasons.length === 0
        ? null
        : `Rejected because ${[...new Set(rejectionReasons)].join(", ")}.`,
    fetchedAt: input.fetchedAt,
    metadata: {
      searchTerm: input.searchTerm,
      sourceCurrency: input.candidate.currency,
      rawExternalId: input.candidate.externalId,
      priceRatioToRenaissFmv: ratio,
      titleSimilarity: Number(similarity.toFixed(4)),
      mockData: input.candidate.fixture === true || !input.live
    }
  };
}
