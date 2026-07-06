import { NextResponse } from "next/server";

import { getCardMemo } from "@/lib/ai-memo-data";

async function handleCardMemo(tokenId: string) {
  const memo = await getCardMemo(decodeURIComponent(tokenId));

  if (memo == null) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }

  return NextResponse.json(memo);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  return handleCardMemo(tokenId);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId } = await params;
  return handleCardMemo(tokenId);
}
