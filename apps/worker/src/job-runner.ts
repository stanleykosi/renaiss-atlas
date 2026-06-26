export const scaffoldJobNames = [
  "sync:renaiss",
  "sync:gacha",
  "score",
  "bundles",
  "intents"
] as const;

export type ScaffoldJobName = (typeof scaffoldJobNames)[number];

export function scaffoldJobResult(jobName: ScaffoldJobName) {
  return {
    jobName,
    status: "skipped",
    reason: "Worker job command exists; product logic is deferred until package schemas and DB fixtures are implemented."
  } as const;
}
