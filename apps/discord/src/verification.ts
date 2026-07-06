import { verifyKey } from "discord-interactions";

export type DiscordVerificationInput = {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey: string | null | undefined;
};

export async function verifyDiscordInteractionRequest(input: DiscordVerificationInput): Promise<boolean> {
  if (
    input.publicKey == null ||
    input.publicKey.length === 0 ||
    input.signature == null ||
    input.signature.length === 0 ||
    input.timestamp == null ||
    input.timestamp.length === 0
  ) {
    return false;
  }

  return verifyKey(input.rawBody, input.signature, input.timestamp, input.publicKey);
}
