import { describe, expect, mock, test } from "bun:test";

const providerCalls: Array<{ modelId: string; source: string }> = [];

mock.module("@ai-sdk/openai", () => ({
  createOpenAI: (settings: Record<string, unknown>) => {
    const source = settings.baseURL
      ? `openai:${settings.baseURL}`
      : "openai:default";
    const chat = (modelId: string) => {
      providerCalls.push({ modelId, source: `${source}:chat` });
      return { modelId };
    };
    const call = (modelId: string) => {
      providerCalls.push({ modelId, source });
      return { modelId };
    };
    call.chat = chat;
    return call;
  },
}));

const { gateway } = await import("./models");

describe("gateway", () => {
  test("uses placeholder provider when no config is provided", () => {
    providerCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6");

    expect(providerCalls).toEqual([
      {
        modelId: "anthropic/claude-sonnet-4.6",
        source: "openai:https://gateway-not-configured.invalid:chat",
      },
    ]);
  });

  test("delegates to custom provider when config is provided", () => {
    providerCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6", {
      config: { baseURL: "https://custom.api", apiKey: "sk-test" },
    });

    expect(providerCalls).toEqual([
      {
        modelId: "anthropic/claude-sonnet-4.6",
        source: "openai:https://custom.api",
      },
    ]);
  });

  test("uses remoteModelId from config when provided", () => {
    providerCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6", {
      config: {
        baseURL: "https://custom.api",
        apiKey: "sk-test",
        remoteModelId: "claude-sonnet-4-6",
      },
    });

    expect(providerCalls).toEqual([
      {
        modelId: "claude-sonnet-4-6",
        source: "openai:https://custom.api",
      },
    ]);
  });
});
