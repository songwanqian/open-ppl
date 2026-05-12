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
    call.responses = (modelId: string) => {
      providerCalls.push({ modelId, source: `${source}:responses` });
      return { modelId };
    };
    return call;
  },
}));

mock.module("@ai-sdk/anthropic", () => ({
  createAnthropic: (settings: Record<string, unknown>) => {
    const source = `anthropic:${settings.baseURL}`;
    return (modelId: string) => {
      providerCalls.push({ modelId, source });
      return { modelId };
    };
  },
}));

mock.module("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (settings: Record<string, unknown>) => {
    const source = `openai-compatible:${settings.baseURL}`;
    return (modelId: string) => {
      providerCalls.push({ modelId, source });
      return { modelId };
    };
  },
}));

mock.module("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: (settings: Record<string, unknown>) => {
    const source = `gemini:${settings.baseURL}`;
    return (modelId: string) => {
      providerCalls.push({ modelId, source });
      return { modelId };
    };
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
        source: "openai-compatible:https://gateway-not-configured.invalid",
      },
    ]);
  });

  test("uses OpenAI responses provider for openai-responses config", () => {
    providerCalls.length = 0;
    gateway("openai/gpt-5.4", {
      config: {
        provider: "openai-responses",
        baseURL: "https://api.openai.com/v1",
        apiKey: "sk-test",
      },
    });

    expect(providerCalls).toEqual([
      {
        modelId: "openai/gpt-5.4",
        source: "openai:https://api.openai.com/v1:responses",
      },
    ]);
  });

  test("uses Anthropic provider for anthropic config", () => {
    providerCalls.length = 0;
    gateway("anthropic/claude-sonnet-4.6", {
      config: {
        provider: "anthropic",
        baseURL: "https://custom.api",
        apiKey: "sk-test",
      },
    });

    expect(providerCalls).toEqual([
      {
        modelId: "anthropic/claude-sonnet-4.6",
        source: "anthropic:https://custom.api",
      },
    ]);
  });

  test("uses OpenAI compatible provider for compatible config", () => {
    providerCalls.length = 0;
    gateway("zai/glm-4.6", {
      config: {
        provider: "openai-compatible",
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
        apiKey: "sk-test",
        remoteModelId: "glm-4.6",
      },
    });

    expect(providerCalls).toEqual([
      {
        modelId: "glm-4.6",
        source: "openai-compatible:https://open.bigmodel.cn/api/paas/v4",
      },
    ]);
  });

  test("uses Gemini provider for gemini config", () => {
    providerCalls.length = 0;
    gateway("google/gemini-3-pro", {
      config: {
        provider: "gemini",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: "sk-test",
        remoteModelId: "gemini-3-pro",
      },
    });

    expect(providerCalls).toEqual([
      {
        modelId: "gemini-3-pro",
        source: "gemini:https://generativelanguage.googleapis.com/v1beta",
      },
    ]);
  });
});
