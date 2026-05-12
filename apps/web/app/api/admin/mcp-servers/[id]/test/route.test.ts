import { beforeEach, describe, expect, mock, test } from "bun:test";

let currentSession: { user: { id: string } } | null = {
  user: { id: "admin-1" },
};
let isAdmin = true;
let serverRecord: Record<string, unknown> | undefined = {
  id: "mcp-1",
  name: "Search API",
  url: "https://search.example.com/mcp",
};
let listResult: string[] | Error = ["search", "fetch"];
const testedServers: Array<Record<string, unknown>> = [];

mock.module("@/lib/session/get-server-session", () => ({
  getServerSession: async () => currentSession,
}));

mock.module("@/lib/db/users", () => ({
  isUserAdmin: async () => isAdmin,
}));

mock.module("@/lib/db/mcp-servers", () => ({
  getMcpServerById: async () => serverRecord,
}));

mock.module("@/lib/search/mcp-runtime", () => ({
  listMcpServerTools: async (server: Record<string, unknown>) => {
    testedServers.push(server);
    if (listResult instanceof Error) {
      throw listResult;
    }
    return listResult;
  },
}));

const routeModulePromise = import("./route");

describe("/api/admin/mcp-servers/[id]/test", () => {
  beforeEach(() => {
    currentSession = { user: { id: "admin-1" } };
    isAdmin = true;
    serverRecord = {
      id: "mcp-1",
      name: "Search API",
      url: "https://search.example.com/mcp",
    };
    listResult = ["search", "fetch"];
    testedServers.length = 0;
  });

  test("lists MCP tools without executing arbitrary tools", async () => {
    const { POST } = await routeModulePromise;
    const expectedServer = serverRecord;
    if (!expectedServer) {
      throw new Error("Expected server fixture");
    }

    const response = await POST(
      new Request("http://localhost/api/admin/mcp-servers/mcp-1/test", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "mcp-1" }) },
    );
    const body = (await response.json()) as {
      success: boolean;
      tools: string[];
    };

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.tools).toEqual(["search", "fetch"]);
    expect(testedServers).toEqual([expectedServer]);
  });

  test("returns a failed test result when the MCP server cannot be reached", async () => {
    const { POST } = await routeModulePromise;
    listResult = new Error("connection refused");

    const response = await POST(
      new Request("http://localhost/api/admin/mcp-servers/mcp-1/test", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "mcp-1" }) },
    );
    const body = (await response.json()) as {
      success: boolean;
      error: string;
    };

    expect(response.ok).toBe(true);
    expect(body.success).toBe(false);
    expect(body.error).toBe("connection refused");
  });

  test("returns 404 for missing MCP server records", async () => {
    const { POST } = await routeModulePromise;
    serverRecord = undefined;

    const response = await POST(
      new Request("http://localhost/api/admin/mcp-servers/missing/test", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(testedServers).toHaveLength(0);
  });
});
