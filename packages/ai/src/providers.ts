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

function urlWithDefault(defaultValue: string) {
  return z.preprocess(
    (value) => (value === "" || value === undefined ? defaultValue : value),
    z.string().url()
  );
}

const booleanFlag = z.preprocess(
  (value) => (value === undefined ? "false" : value),
  z.enum(["true", "false"]).transform((value) => value === "true")
);

export const AiProviderEnvSchema = z.object({
  AI_ENABLED: booleanFlag,
  AI_PROVIDER: z.enum(["auto", "openai", "mimo", "deterministic"]).default("auto"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: urlWithDefault("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  MIMO_API_KEY: z.string().optional(),
  MIMO_BASE_URL: urlWithDefault("https://token-plan-cn.xiaomimimo.com/v1"),
  MIMO_MODEL: z.string().min(1).default("mimo-v2.5")
});

export type AiProviderEnv = z.infer<typeof AiProviderEnvSchema>;

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

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name: string;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(input: {
    name: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    fetchFn?: typeof fetch;
  }) {
    this.name = input.name;
    this.apiKey = input.apiKey;
    this.baseUrl = input.baseUrl.replace(/\/$/, "");
    this.model = input.model;
    this.fetchFn = input.fetchFn ?? fetch;
  }

  async generateCardMemo(request: CardMemoProviderRequest): Promise<unknown> {
    const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
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
  if (!env.AI_ENABLED || env.AI_PROVIDER === "deterministic") return null;

  if ((env.AI_PROVIDER === "auto" || env.AI_PROVIDER === "mimo") && env.MIMO_API_KEY != null) {
    return new OpenAiCompatibleProvider({
      name: "mimo",
      apiKey: env.MIMO_API_KEY,
      baseUrl: env.MIMO_BASE_URL,
      model: env.MIMO_MODEL
    });
  }

  if ((env.AI_PROVIDER === "auto" || env.AI_PROVIDER === "openai") && env.OPENAI_API_KEY != null) {
    return new OpenAiCompatibleProvider({
      name: "openai",
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      model: env.OPENAI_MODEL
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
