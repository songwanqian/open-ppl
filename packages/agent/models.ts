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

const githubProvider = createOpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_TOKEN,
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

  return githubProvider.chat(modelId);
}

export type { LanguageModel };
