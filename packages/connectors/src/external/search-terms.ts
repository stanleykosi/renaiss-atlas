import type { ExternalCompCardInput } from "./types.js";

function compact(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function cleanTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(cleanTerm).filter((value) => value.length > 0))];
}

export function generateExternalCompSearchTerms(card: ExternalCompCardInput): string[] {
  const year = compact(card.year);
  const tcg = compact(card.tcg);
  const setName = compact(card.setName);
  const cardNumber = compact(card.cardNumber);
  const character = compact(card.characterName) ?? compact(card.name);
  const grader = compact(card.grader);
  const grade = compact(card.grade);
  const language = compact(card.language);
  const title = compact(card.name);
  const graded = unique([grader, grade].filter((value): value is string => value != null)).join(" ");
  const numbered = cardNumber == null ? null : `#${cardNumber}`;

  return unique([
    [year, tcg, setName, numbered, character, graded].filter(Boolean).join(" "),
    [character, cardNumber, setName, graded].filter(Boolean).join(" "),
    [language, setName, cardNumber, character].filter(Boolean).join(" "),
    [title, graded].filter(Boolean).join(" "),
    [tcg, character, cardNumber].filter(Boolean).join(" ")
  ]);
}
