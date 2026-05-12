import { z } from "zod";

export const GATEWAY_PROVIDER_IDS = [
  "openai-responses",
  "anthropic",
  "openai-compatible",
  "gemini",
] as const;

export const gatewayProviderSchema = z.enum(GATEWAY_PROVIDER_IDS);

export type GatewayProviderId = z.infer<typeof gatewayProviderSchema>;

export interface GatewayProviderPreset {
  label: string;
  value: GatewayProviderId;
  baseURL: string;
}

export const GATEWAY_PROVIDER_PRESETS: GatewayProviderPreset[] = [
  {
    label: "OpenAI Responses",
    value: "openai-responses",
    baseURL: "https://api.openai.com/v1",
  },
  {
    label: "Anthropic",
    value: "anthropic",
    baseURL: "https://api.anthropic.com/v1",
  },
  {
    label: "OpenAI Compatible",
    value: "openai-compatible",
    baseURL: "",
  },
  {
    label: "Gemini",
    value: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
  },
];

export function isGatewayProviderId(value: string): value is GatewayProviderId {
  return gatewayProviderSchema.safeParse(value).success;
}

export function normalizeGatewayProvider(
  provider: string,
): GatewayProviderId | null {
  if (isGatewayProviderId(provider)) {
    return provider;
  }

  if (provider === "google-gemini") {
    return "gemini";
  }

  return null;
}

export function normalizeGatewayBaseURL(
  provider: GatewayProviderId,
  baseURL: string,
): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");

  if (provider === "gemini" && trimmed.endsWith("/openai")) {
    return trimmed.slice(0, -"/openai".length);
  }

  return trimmed;
}
