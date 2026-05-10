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
  test("delegates to github provider for standard calls", () => {
    providerCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6");

    expect(providerCalls).toEqual([
      {
        modelId: "anthropic/claude-sonnet-4.6",
        source: "openai:https://models.github.ai/inference:chat",
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

  test("passes model id unchanged to provider", () => {
    providerCalls.length = 0;
    gateway("openai/gpt-5.4");

    expect(providerCalls).toEqual([
      {
        modelId: "openai/gpt-5.4",
        source: "openai:https://models.github.ai/inference:chat",
      },
    ]);
  });
});
