import { createMcpServer, getAllMcpServers } from "@/lib/db/mcp-servers";
import { requireAdmin } from "../_lib/require-admin";
import { createMcpServerSchema } from "./_schema";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const servers = await getAllMcpServers();
  return Response.json({ servers });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createMcpServerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const server = await createMcpServer(parsed.data);
  return Response.json({ server }, { status: 201 });
}
