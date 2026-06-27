import type { MarketCard, MarketFilters, MarketSortKey } from "@/lib/market-types";

export const defaultMarketFilters: MarketFilters = {
  q: "",
  status: "all",
  language: "all",
  grader: "all",
  grade: "all",
  sortBy: "liquidityScore",
  sortDir: "desc",
  mismatchesOnly: false
};

function searchable(card: MarketCard): string {
  return [
    card.name,
    card.setName,
    card.cardNumber,
    card.characterName,
    card.tcg,
    card.grader,
    card.grade,
    card.language,
    card.serial
  ]
    .filter((value): value is string => value != null && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function comparableValue(card: MarketCard, key: MarketSortKey): string | number {
  const value = card[key];
  if (key === "name") return card.name.toLowerCase();
  if (key === "observedAt") return value == null ? 0 : Date.parse(String(value));
  return typeof value === "number" ? value : -1;
}

export function filterMarketCards(cards: readonly MarketCard[], filters: MarketFilters) {
  const query = filters.q.trim().toLowerCase();

  return cards.filter((card) => {
    if (query.length > 0 && !searchable(card).includes(query)) return false;
    if (filters.status !== "all" && card.status !== filters.status) return false;
    if (filters.language !== "all" && card.language !== filters.language) return false;
    if (filters.grader !== "all" && card.grader !== filters.grader) return false;
    if (filters.grade !== "all" && card.grade !== filters.grade) return false;
    if (filters.mismatchesOnly && !card.externalComps.some((comp) => comp.rejected)) return false;
    return true;
  });
}

export function sortMarketCards(cards: readonly MarketCard[], filters: MarketFilters) {
  return [...cards].sort((left, right) => {
    const leftValue = comparableValue(left, filters.sortBy);
    const rightValue = comparableValue(right, filters.sortBy);
    const direction = filters.sortDir === "asc" ? 1 : -1;

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      return leftValue.localeCompare(rightValue) * direction;
    }

    return (Number(leftValue) - Number(rightValue)) * direction;
  });
}

export function applyMarketFilters(cards: readonly MarketCard[], filters: MarketFilters) {
  return sortMarketCards(filterMarketCards(cards, filters), filters);
}

export function toggleSort(current: MarketFilters, sortBy: MarketSortKey): MarketFilters {
  return {
    ...current,
    sortBy,
    sortDir: current.sortBy === sortBy && current.sortDir === "desc" ? "asc" : "desc"
  };
}
