import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface GatewayConfig {
  baseURL: string;
  apiKey: string;
  remoteModelId?: string;
}

export interface GatewayOptions {
  config?: GatewayConfig;
}

const placeholderProvider = createOpenAI({
  baseURL: "https://gateway-not-configured.invalid",
  apiKey: "not-configured",
});

export function gateway(
  modelId: string,
  options: GatewayOptions = {},
): LanguageModel {
  if (options.config) {
    const actualModelId = options.config.remoteModelId ?? modelId;
    const customProvider = createOpenAI({
      baseURL: options.config.baseURL,
      apiKey: options.config.apiKey,
    });
    return customProvider(actualModelId);
  }

  return placeholderProvider.chat(modelId);
}

export const DEFAULT_FAST_MODEL_ID = "anthropic/claude-haiku-4.5";

export type { LanguageModel };
