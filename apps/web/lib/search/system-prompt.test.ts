import { beforeEach, describe, expect, mock, test } from "bun:test";

let requestedMode: string | null = null;
let promptResult:
  | {
      content: string;
    }
  | Error = {
  content: "Answer with citations.",
};

mock.module("@/lib/db/system-prompts", () => ({
  getActiveSystemPromptForMode: async (mode: string) => {
    requestedMode = mode;
    if (promptResult instanceof Error) {
      throw promptResult;
    }
    return promptResult;
  },
}));

const { loadSearchSystemPrompt } = await import("./system-prompt");

describe("loadSearchSystemPrompt", () => {
  beforeEach(() => {
    requestedMode = null;
    promptResult = {
      content: "Answer with citations.",
    };
  });

  test("loads the active search prompt content", async () => {
    await expect(loadSearchSystemPrompt()).resolves.toBe(
      "Answer with citations.",
    );
    expect(requestedMode).toBe("search");
  });

  test("surfaces missing or ambiguous search prompt configuration", async () => {
    promptResult = new Error(
      "Expected exactly one enabled search system prompt",
    );

    await expect(loadSearchSystemPrompt()).rejects.toThrow(
      "Expected exactly one enabled search system prompt",
    );
  });
});
