import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export const GATEWAY_PROVIDER_IDS = [
  "openai-responses",
  "anthropic",
  "openai-compatible",
  "gemini",
] as const;

export type GatewayProviderId = (typeof GATEWAY_PROVIDER_IDS)[number];

export interface GatewayConfig {
  provider: GatewayProviderId;
  baseURL: string;
  apiKey: string;
  remoteModelId?: string;
}

export interface GatewayOptions {
  config?: GatewayConfig;
}

function isGatewayProviderId(value: string): value is GatewayProviderId {
  return GATEWAY_PROVIDER_IDS.some((provider) => provider === value);
}

export function parseGatewayProviderId(value: string): GatewayProviderId {
  if (!isGatewayProviderId(value)) {
    throw new Error(`Unsupported gateway provider: ${value}`);
  }

  return value;
}

function createConfiguredModel(
  provider: GatewayProviderId,
  modelId: string,
  config: Omit<GatewayConfig, "provider">,
): LanguageModel {
  switch (provider) {
    case "openai-responses":
      return createOpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      }).responses(modelId);
    case "anthropic":
      return createAnthropic({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      })(modelId);
    case "openai-compatible":
      return createOpenAICompatible({
        name: "openai-compatible",
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      })(modelId);
    case "gemini":
      return createGoogleGenerativeAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      })(modelId);
  }
}

export function gateway(
  modelId: string,
  options: GatewayOptions = {},
): LanguageModel {
  if (options.config) {
    const actualModelId = options.config.remoteModelId ?? modelId;
    return createConfiguredModel(options.config.provider, actualModelId, {
      baseURL: options.config.baseURL,
      apiKey: options.config.apiKey,
      remoteModelId: options.config.remoteModelId,
    });
  }

  return createConfiguredModel("openai-compatible", modelId, {
    baseURL: "https://gateway-not-configured.invalid",
    apiKey: "not-configured",
  });
}

export const DEFAULT_FAST_MODEL_ID = "anthropic/claude-haiku-4.5";

export type { LanguageModel };
