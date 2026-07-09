type GradeDisplayInput = {
  company?: string | null | undefined;
  grade?: string | null | undefined;
  gradeLabel?: string | null | undefined;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed == null || trimmed.length === 0 ? null : trimmed;
}

function rawBucket(input: GradeDisplayInput): string | null {
  const company = clean(input.company)?.toUpperCase();
  const grade = clean(input.grade);
  const gradeLabel = clean(input.gradeLabel);
  const candidates = [gradeLabel, grade].filter((value): value is string => value != null);

  for (const candidate of candidates) {
    const rawMatch = /^RAW[\s_-]*([A-D])$/i.exec(candidate);
    if (rawMatch?.[1] != null) return rawMatch[1].toUpperCase();

    const ungradedMatch = /^Ungraded[\s_-]*([A-D])$/i.exec(candidate);
    if (ungradedMatch?.[1] != null) return ungradedMatch[1].toUpperCase();

    if (company === "RAW" && /^[A-D]$/i.test(candidate)) return candidate.toUpperCase();
  }

  return null;
}

export function formatGradeLabel(input: GradeDisplayInput): string {
  const bucket = rawBucket(input);
  if (bucket != null) return `Ungraded ${bucket}`;

  return clean(input.gradeLabel) ?? clean(input.grade) ?? "Unknown grade";
}

export function gradeLabelTitle(input: GradeDisplayInput): string {
  const bucket = rawBucket(input);
  if (bucket != null) {
    return `Ungraded card in Renaiss raw condition bucket ${bucket}.`;
  }

  const company = clean(input.company)?.toUpperCase();
  const grade = clean(input.grade);
  const label = formatGradeLabel(input);

  if (company === "PSA" && grade != null) return `PSA graded ${grade}.`;
  if (/^PSA\s+10$/i.test(label)) return "PSA graded 10 Gem Mint.";

  return `Grade label returned by Renaiss: ${label}.`;
}
