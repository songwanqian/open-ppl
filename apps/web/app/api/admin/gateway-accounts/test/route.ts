import { z } from "zod";
import { getServerSession } from "@/lib/session/get-server-session";
import { isUserAdmin } from "@/lib/db/users";
import { fetchRemoteGatewayModels } from "@/lib/gateway-remote-models";
import { gatewayProviderSchema } from "@/lib/gateway-providers";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: "Not authenticated", status: 401 };
  }
  const admin = await isUserAdmin(session.user.id);
  if (!admin) {
    return { error: "Forbidden", status: 403 };
  }
  return { userId: session.user.id };
}

const testSchema = z.object({
  provider: gatewayProviderSchema,
  baseURL: z.string().trim().min(1),
  apiKey: z.string().optional(),
});

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

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { provider, baseURL, apiKey } = parsed.data;

  const start = performance.now();
  try {
    const models = await fetchRemoteGatewayModels({
      provider,
      baseURL,
      apiKey,
    });
    const latency = Math.round(performance.now() - start);

    return Response.json({
      success: true,
      latency,
      modelCount: models.length,
    });
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : "Connection failed";
    return Response.json({
      success: false,
      latency,
      error: message,
    });
  }
}
