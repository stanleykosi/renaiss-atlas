import { z } from "zod";

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

const booleanFlag = z.preprocess(
  (value) => (value === undefined ? "false" : value),
  z.enum(["true", "false"]).transform((value) => value === "true")
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

export const AiProviderEnvSchema = z.object({
  AI_ENABLED: booleanFlag,
  OPENROUTER_API_KEY: z.preprocess((value) => (value === "" ? undefined : value), z.string().optional()),
  OPENROUTER_MODEL: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional()),
  NEXT_PUBLIC_APP_URL: optionalUrl
});

export type AiProviderEnv = z.infer<typeof AiProviderEnvSchema>;

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

    return JSON.parse(content) as unknown;
  }
}

export function createAiProviderFromEnv(
  rawEnv: Record<string, string | undefined> = process.env
): AiProvider | null {
  const env = AiProviderEnvSchema.parse(rawEnv);
  if (!env.AI_ENABLED) return null;

  if (env.OPENROUTER_API_KEY != null && env.OPENROUTER_MODEL != null) {
    return new OpenRouterProvider({
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      referer: env.NEXT_PUBLIC_APP_URL
    });
  }

  return null;
}

export function buildCardMemoProviderRequest(input: AiMemoInput): CardMemoProviderRequest {
  return {
    input,
    systemPrompt: CARD_MEMO_SYSTEM_PROMPT,
    userPrompt: buildCardMemoUserPrompt(input)
  };
}
