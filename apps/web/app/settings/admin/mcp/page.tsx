import { McpServersSection } from "./mcp-servers-section";

export default function AdminMcpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">MCP Servers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure HTTP MCP tools available to Search sessions.
        </p>
      </div>
      <McpServersSection />
    </div>
  );
}
