import type { ExternalCompCandidate, ExternalCompSourcePlatform } from "./types.js";

function parseMoney(value: string): { amount: number; currency: string } | null {
  const cleaned = value.replace(/,/g, "");
  const yen = /¥\s*(\d+(?:\.\d+)?)/.exec(cleaned);
  if (yen != null) return { amount: Number(yen[1]), currency: "JPY" };
  const usd = /\$\s*(\d+(?:\.\d+)?)/.exec(cleaned);
  if (usd != null) return { amount: Number(usd[1]), currency: "USD" };
  return null;
}

function findCardNumber(text: string): string | null {
  const hash = /#\s*([A-Z0-9-]+)/i.exec(text);
  if (hash != null) return hash[1] ?? null;
  return null;
}

function findGrade(text: string): string | null {
  const grade = /(PSA|BGS|CGC)\s*(10|9\.5|9|8\.5|8|7\.5|7)/i.exec(text);
  if (grade == null) return null;
  return `${grade[1]?.toUpperCase()} ${grade[2]}`;
}

function findLanguage(text: string): string | null {
  if (/japanese/i.test(text)) return "Japanese";
  if (/english/i.test(text)) return "English";
  return null;
}

export function parseMarkdownCompCandidates(input: {
  text: string;
  platform: ExternalCompSourcePlatform;
  productUrl: string;
}): ExternalCompCandidate[] {
  const candidates: ExternalCompCandidate[] = [];
  const lines = input.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const [index, line] of lines.entries()) {
    const money = parseMoney(line);
    if (money == null || !Number.isFinite(money.amount)) continue;
    const title = line.replace(/\s+/g, " ").slice(0, 180);
    candidates.push({
      externalId: `${input.platform}:reader:${index}`,
      platform: input.platform,
      productTitle: title,
      productUrl: input.productUrl,
      currency: money.currency,
      currentPrice: money.amount,
      grade: findGrade(line),
      language: findLanguage(line),
      cardNumber: findCardNumber(line),
      raw: { line }
    });
  }

  return candidates.slice(0, 10);
}
