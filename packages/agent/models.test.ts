import { describe, expect, mock, test } from "bun:test";

const providerCalls: Array<{ modelId: string; source: string }> = [];

mock.module("@github/models", () => ({
  createGitHubModels: () => {
    const call = (modelId: string) => {
      providerCalls.push({ modelId, source: "github" });
      return { modelId };
    };
    return call;
  },
}));

mock.module("@ai-sdk/openai", () => ({
  createOpenAI: (settings: Record<string, unknown>) => {
    const call = (modelId: string) => {
      providerCalls.push({
        modelId,
        source: `custom:${settings.baseURL}`,
      });
      return { modelId };
    };
    return call;
  },
}));

const { gateway } = await import("./models");

describe("gateway", () => {
  test("delegates to github provider for standard calls", () => {
    providerCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6");

    expect(providerCalls).toEqual([
      { modelId: "anthropic/claude-sonnet-4.6", source: "github" },
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
        source: "custom:https://custom.api",
      },
    ]);
  });

  test("passes model id unchanged to provider", () => {
    providerCalls.length = 0;
    gateway("openai/gpt-5.4");

    expect(providerCalls).toEqual([
      { modelId: "openai/gpt-5.4", source: "github" },
    ]);
  });
});
