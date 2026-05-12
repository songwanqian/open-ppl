import { beforeEach, describe, expect, mock, test } from "bun:test";

let currentSession: { user: { id: string } } | null = {
  user: { id: "admin-1" },
};
let isAdmin = true;
const prompts: Array<Record<string, unknown>> = [];
const createCalls: Array<Record<string, unknown>> = [];

mock.module("@/lib/session/get-server-session", () => ({
  getServerSession: async () => currentSession,
}));

mock.module("@/lib/db/users", () => ({
  isUserAdmin: async () => isAdmin,
}));

mock.module("@/lib/db/system-prompts", () => ({
  getAllSystemPrompts: async () => prompts,
  createSystemPrompt: async (data: Record<string, unknown>) => {
    createCalls.push(data);
    return { id: "prompt-1", ...data };
  },
}));

const routeModulePromise = import("./route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/system-prompts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/system-prompts", () => {
  beforeEach(() => {
    currentSession = { user: { id: "admin-1" } };
    isAdmin = true;
    prompts.length = 0;
    createCalls.length = 0;
  });

  test("requires an admin user", async () => {
    const { GET } = await routeModulePromise;
    isAdmin = false;

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  test("creates a validated system prompt", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      jsonRequest({
        name: "Search default",
        mode: "search",
        content: "Answer with citations.",
        enabled: true,
      }),
    );
    const body = (await response.json()) as {
      prompt: Record<string, unknown>;
    };

    expect(response.status).toBe(201);
    expect(createCalls).toEqual([
      {
        name: "Search default",
        mode: "search",
        content: "Answer with citations.",
        enabled: true,
      },
    ]);
    expect(body.prompt.id).toBe("prompt-1");
  });

  test("rejects invalid prompt payloads", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      jsonRequest({
        name: "",
        mode: "search",
        content: "",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(createCalls).toHaveLength(0);
  });
});
