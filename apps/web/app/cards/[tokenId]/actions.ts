"use server";

import { AiMemoGenerationError, type AiCardMemoResult } from "@renaiss/ai";

import { decodeRenaissOsCardToken, generateRenaissOsCollectorBrief } from "@/lib/renaiss-os/data";

export type GenerateCollectorBriefResult =
  | { ok: true; brief: AiCardMemoResult }
  | { ok: false; error: string };

export async function generateCollectorBrief(
  tokenId: string
): Promise<GenerateCollectorBriefResult> {
  const path = decodeRenaissOsCardToken(tokenId);
  if (path == null) {
    return { ok: false, error: "Renaiss card could not be found." };
  }

  try {
    const brief = await generateRenaissOsCollectorBrief(path);
    return { ok: true, brief };
  } catch (error) {
    const reason =
      error instanceof Error ? `${error.name}: ${error.message}` : "non-Error rejection";
    console.error(`[collector-brief] Generation failed. ${reason.replace(/\s+/g, " ")}`);

    return {
      ok: false,
      error:
        error instanceof AiMemoGenerationError
          ? error.publicMessage
          : "Collector Brief could not be generated."
    };
  }
}
