import { z } from "zod";

import { cleanEnvString } from "@renaiss/core";

import { buildCardMemoUserPrompt, CARD_MEMO_SYSTEM_PROMPT } from "./prompts.js";
import type { AiMemoInput } from "./schemas.js";

export type CardMemoProviderRequest = {
  input: AiMemoInput;
  systemPrompt: string;
  userPrompt: string;
};

export type AiProvider = {
  name: string;
  model: string;
  generateCardMemo(request: CardMemoProviderRequest): Promise<unknown>;
};

const optionalUrl = z.preprocess(cleanEnvString, z.string().url().optional());

const AiProviderEnvSchema = z.object({
  OPENROUTER_API_KEY: z.preprocess(cleanEnvString, z.string().min(1)),
  OPENROUTER_MODEL: z.preprocess(cleanEnvString, z.string().min(1)),
  NEXT_PUBLIC_APP_URL: optionalUrl
});

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const ChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable()
        })
      })
    )
    .min(1)
});

function parseJsonObject(content: string): unknown {
  return JSON.parse(content) as unknown;
}

export class OpenRouterProvider implements AiProvider {
  readonly name: string;
  readonly model: string;

  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly referer: string | undefined;

  constructor(input: {
    apiKey: string;
    model: string;
    referer?: string | undefined;
    fetchFn?: typeof fetch;
  }) {
    this.name = "openrouter";
    this.apiKey = input.apiKey;
    this.model = input.model;
    this.referer = input.referer;
    this.fetchFn = input.fetchFn ?? fetch;
  }

  async generateCardMemo(request: CardMemoProviderRequest): Promise<unknown> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
      "x-title": "Renaiss Atlas"
    };
    if (this.referer != null) {
      headers["http-referer"] = this.referer;
    }

    const response = await this.fetchFn(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`AI provider ${this.name} failed with ${response.status}`);
    }

    const parsed = ChatCompletionResponseSchema.parse(await response.json());
    const content = parsed.choices[0]?.message.content;
    if (content == null || content.trim().length === 0) {
      throw new Error(`AI provider ${this.name} returned an empty memo`);
    }

    return parseJsonObject(content);
  }
}

export function createAiProviderFromEnv(
  rawEnv: Record<string, string | undefined> = process.env
): AiProvider {
  const env = AiProviderEnvSchema.parse(rawEnv);

  return new OpenRouterProvider({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    referer: env.NEXT_PUBLIC_APP_URL
  });
}

export function buildCardMemoProviderRequest(input: AiMemoInput): CardMemoProviderRequest {
  return {
    input,
    systemPrompt: CARD_MEMO_SYSTEM_PROMPT,
    userPrompt: buildCardMemoUserPrompt(input)
  };
}
