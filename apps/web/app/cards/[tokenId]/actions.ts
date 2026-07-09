"use server";

import type { AiCardMemoResult } from "@renaiss/ai";

import { generateRenaissOsCollectorBrief } from "@/lib/renaiss-os/data";

export type GenerateCollectorBriefResult =
  | { ok: true; brief: AiCardMemoResult }
  | { ok: false; error: string };

export async function generateCollectorBrief(tokenId: string): Promise<GenerateCollectorBriefResult> {
  try {
    const brief = await generateRenaissOsCollectorBrief(tokenId);
    if (brief == null) {
      return { ok: false, error: "Renaiss card could not be found." };
    }

    return { ok: true, brief };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Collector Brief could not be generated."
    };
  }
}
