import { beforeEach, describe, expect, mock, test } from "bun:test";

let currentSession: { user: { id: string } } | null = {
  user: { id: "admin-1" },
};
let isAdmin = true;
const servers: Array<Record<string, unknown>> = [];
const createCalls: Array<Record<string, unknown>> = [];

mock.module("@/lib/session/get-server-session", () => ({
  getServerSession: async () => currentSession,
}));

mock.module("@/lib/db/users", () => ({
  isUserAdmin: async () => isAdmin,
}));

mock.module("@/lib/db/mcp-servers", () => ({
  getAllMcpServers: async () => servers,
  createMcpServer: async (data: Record<string, unknown>) => {
    createCalls.push(data);
    return { id: "mcp-1", ...data };
  },
}));

const routeModulePromise = import("./route");

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/mcp-servers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/mcp-servers", () => {
  beforeEach(() => {
    currentSession = { user: { id: "admin-1" } };
    isAdmin = true;
    servers.length = 0;
    createCalls.length = 0;
  });

  test("returns configured MCP servers for admins", async () => {
    const { GET } = await routeModulePromise;
    servers.push({ id: "mcp-1", name: "Search API" });

    const response = await GET();

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual({ servers });
  });

  test("creates an HTTP MCP server with string headers", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      jsonRequest({
        name: "Search API",
        purpose: "search",
        url: "https://search.example.com/mcp",
        headers: { Authorization: "Bearer token" },
      }),
    );

    expect(response.status).toBe(201);
    expect(createCalls).toEqual([
      {
        name: "Search API",
        purpose: "search",
        url: "https://search.example.com/mcp",
        headers: { Authorization: "Bearer token" },
        enabled: true,
      },
    ]);
  });

  test("rejects localhost MCP URLs", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      jsonRequest({
        name: "Local MCP",
        purpose: "search",
        url: "http://localhost:8787/mcp",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(createCalls).toHaveLength(0);
  });

  test("rejects non-string MCP headers", async () => {
    const { POST } = await routeModulePromise;

    const response = await POST(
      jsonRequest({
        name: "Search API",
        purpose: "search",
        url: "https://search.example.com/mcp",
        headers: { Authorization: 123 },
      }),
    );

    expect(response.status).toBe(400);
    expect(createCalls).toHaveLength(0);
  });
});
