import { createGitHubModels } from "@github/models";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface GatewayConfig {
  baseURL: string;
  apiKey: string;
}

export interface GatewayOptions {
  config?: GatewayConfig;
}

const githubProvider = createGitHubModels();

export function gateway(
  modelId: string,
  options: GatewayOptions = {},
): LanguageModel {
  if (options.config) {
    const customProvider = createOpenAI({
      baseURL: options.config.baseURL,
      apiKey: options.config.apiKey,
    });
    return customProvider(modelId);
  }

  return githubProvider(modelId);
}

export type { LanguageModel };
