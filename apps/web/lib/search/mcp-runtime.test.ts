import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ToolSet } from "ai";
import type { McpServer } from "@/lib/db/schema";

const createdClients: Array<{
  transport: {
    type: "http";
    url: string;
    headers: Record<string, string>;
    redirect: "error";
  };
}> = [];
const closedClients: string[] = [];
let enabledPurposes: string[] | undefined;
let enabledServers: McpServer[] = [];
let toolsByUrl: Record<string, ToolSet> = {};
let throwForUrl: string | null = null;

function createServer(overrides: Partial<McpServer>): McpServer {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "server-1",
    name: "Search API",
    purpose: "search",
    url: "https://search.example.com/mcp",
    headers: {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

mock.module("@/lib/db/mcp-servers", () => ({
  getEnabledMcpServers: async (purposes?: string[]) => {
    enabledPurposes = purposes;
    return enabledServers;
  },
}));

mock.module("@ai-sdk/mcp", () => ({
  createMCPClient: async (config: {
    transport: {
      type: "http";
      url: string;
      headers: Record<string, string>;
      redirect: "error";
    };
  }) => {
    createdClients.push(config);
    if (throwForUrl === config.transport.url) {
      throw new Error("MCP connect failed");
    }
    return {
      tools: async () => toolsByUrl[config.transport.url] ?? {},
      close: async () => {
        closedClients.push(config.transport.url);
      },
    };
  },
}));

const { closeSearchMcpRuntime, createSearchMcpRuntime, listMcpServerTools } =
  await import("./mcp-runtime");

describe("search MCP runtime", () => {
  beforeEach(() => {
    createdClients.length = 0;
    closedClients.length = 0;
    enabledPurposes = undefined;
    enabledServers = [];
    toolsByUrl = {};
    throwForUrl = null;
  });

  test("loads enabled search and web-fetch MCP servers as namespaced tools", async () => {
    enabledServers = [
      createServer({
        id: "search-1",
        name: "Search API",
        purpose: "search",
        url: "https://search.example.com/mcp",
      }),
      createServer({
        id: "fetch-1",
        name: "Fetch API",
        purpose: "web_fetch",
        url: "https://fetch.example.com/mcp",
        headers: { Authorization: "Bearer token" },
      }),
    ];
    toolsByUrl = {
      "https://search.example.com/mcp": {
        query: { execute: async () => ({}) },
      } as unknown as ToolSet,
      "https://fetch.example.com/mcp": {
        read_url: { execute: async () => ({}) },
      } as unknown as ToolSet,
    };

    const runtime = await createSearchMcpRuntime();

    expect(enabledPurposes).toEqual(["search", "web_fetch"]);
    expect(Object.keys(runtime.tools).toSorted()).toEqual([
      "fetch_api_read_url",
      "search_api_query",
    ]);
    expect(runtime.toolSources).toEqual({
      fetch_api_read_url: {
        serverId: "fetch-1",
        serverName: "Fetch API",
      },
      search_api_query: {
        serverId: "search-1",
        serverName: "Search API",
      },
    });
    expect(createdClients.map((client) => client.transport)).toEqual([
      {
        type: "http",
        url: "https://search.example.com/mcp",
        headers: {},
        redirect: "error",
      },
      {
        type: "http",
        url: "https://fetch.example.com/mcp",
        headers: { Authorization: "Bearer token" },
        redirect: "error",
      },
    ]);
    await closeSearchMcpRuntime(runtime);
    expect(closedClients.toSorted()).toEqual([
      "https://fetch.example.com/mcp",
      "https://search.example.com/mcp",
    ]);
  });

  test("closes already-open clients when a later MCP connection fails", async () => {
    enabledServers = [
      createServer({ url: "https://search.example.com/mcp" }),
      createServer({
        id: "fetch-1",
        name: "Fetch API",
        purpose: "web_fetch",
        url: "https://fetch.example.com/mcp",
      }),
    ];
    toolsByUrl = {
      "https://search.example.com/mcp": {
        query: { execute: async () => ({}) },
      } as unknown as ToolSet,
    };
    throwForUrl = "https://fetch.example.com/mcp";

    await expect(createSearchMcpRuntime()).rejects.toThrow(
      "MCP connect failed",
    );
    expect(closedClients).toEqual(["https://search.example.com/mcp"]);
  });

  test("lists MCP server tools and closes the test client", async () => {
    const server = createServer({
      url: "https://search.example.com/mcp",
    });
    toolsByUrl = {
      "https://search.example.com/mcp": {
        z_tool: { execute: async () => ({}) },
        a_tool: { execute: async () => ({}) },
      } as unknown as ToolSet,
    };

    await expect(listMcpServerTools(server)).resolves.toEqual([
      "a_tool",
      "z_tool",
    ]);
    expect(closedClients).toEqual(["https://search.example.com/mcp"]);
  });
});
