import type { ToolSet } from "ai";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { McpServer } from "@/lib/db/schema";
import { getEnabledMcpServers } from "@/lib/db/mcp-servers";

export type SearchMcpRuntime = {
  tools: ToolSet;
  clients: MCPClient[];
  toolSources: Record<string, { serverId: string; serverName: string }>;
};

function slugifyToolNamespace(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "mcp";
}

function namespaceTools(
  server: McpServer,
  tools: ToolSet,
): Pick<SearchMcpRuntime, "tools" | "toolSources"> {
  const namespace = slugifyToolNamespace(server.name);
  const namespacedTools: ToolSet = {};
  const toolSources: SearchMcpRuntime["toolSources"] = {};

  for (const [toolName, tool] of Object.entries(tools)) {
    const namespacedName = `${namespace}_${toolName}`;
    namespacedTools[namespacedName] = tool;
    toolSources[namespacedName] = {
      serverId: server.id,
      serverName: server.name,
    };
  }

  return { tools: namespacedTools, toolSources };
}

export async function createSearchMcpRuntime(): Promise<SearchMcpRuntime> {
  const servers = await getEnabledMcpServers(["search", "web_fetch"]);
  const clients: MCPClient[] = [];
  const runtime: SearchMcpRuntime = {
    tools: {},
    clients,
    toolSources: {},
  };

  try {
    for (const server of servers) {
      const client = await createMCPClient({
        transport: {
          type: "http",
          url: server.url,
          headers: server.headers,
          redirect: "error",
        },
      });
      clients.push(client);

      const tools = (await client.tools()) as unknown as ToolSet;
      const serverTools = namespaceTools(server, tools);
      runtime.tools = { ...runtime.tools, ...serverTools.tools };
      runtime.toolSources = {
        ...runtime.toolSources,
        ...serverTools.toolSources,
      };
    }

    return runtime;
  } catch (error) {
    await closeSearchMcpRuntime(runtime);
    throw error;
  }
}

export async function closeSearchMcpRuntime(
  runtime: Pick<SearchMcpRuntime, "clients">,
): Promise<void> {
  await Promise.allSettled(runtime.clients.map((client) => client.close()));
}

export async function listMcpServerTools(server: McpServer): Promise<string[]> {
  const client = await createMCPClient({
    transport: {
      type: "http",
      url: server.url,
      headers: server.headers,
      redirect: "error",
    },
  });

  try {
    return Object.keys(await client.tools()).toSorted();
  } finally {
    await client.close();
  }
}
