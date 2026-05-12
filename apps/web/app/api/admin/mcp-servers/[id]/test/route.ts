import { getMcpServerById } from "@/lib/db/mcp-servers";
import { listMcpServerTools } from "@/lib/search/mcp-runtime";
import { requireAdmin } from "../../../_lib/require-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const server = await getMcpServerById(id);
  if (!server) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const start = performance.now();
  try {
    const tools = await listMcpServerTools(server);
    return Response.json({
      success: true,
      latency: Math.round(performance.now() - start),
      tools,
    });
  } catch (error) {
    return Response.json({
      success: false,
      latency: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : "MCP test failed",
    });
  }
}
