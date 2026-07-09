"use server";

import type { AiCardMemoResult } from "@renaiss/ai";

import { generateRenaissOsCardMemo } from "@/lib/renaiss-os/data";

export type GenerateCollectorReadResult =
  | { ok: true; memo: AiCardMemoResult }
  | { ok: false; error: string };

export async function generateCollectorRead(tokenId: string): Promise<GenerateCollectorReadResult> {
  try {
    const memo = await generateRenaissOsCardMemo(tokenId);
    if (memo == null) {
      return { ok: false, error: "Renaiss card could not be found." };
    }

    return { ok: true, memo };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Collector read could not be generated."
    };
  }
}
