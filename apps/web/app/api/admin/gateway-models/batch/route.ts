import { z } from "zod";
import { createGatewayModel } from "@/lib/db/gateway-models";
import { getServerSession } from "@/lib/session/get-server-session";
import { isUserAdmin } from "@/lib/db/users";

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

const importItemSchema = z.object({
  name: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  remoteModelId: z.string().trim().min(1).optional().nullable(),
  gatewayAccountId: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  contextWindow: z.number().int().positive().optional().nullable(),
});

const batchSchema = z.object({
  imports: z.array(importItemSchema).min(1).max(100),
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

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results = [];
  for (const item of parsed.data.imports) {
    try {
      const model = await createGatewayModel({
        name: item.name,
        modelId: item.modelId,
        remoteModelId: item.remoteModelId ?? null,
        gatewayAccountId: item.gatewayAccountId,
        enabled: true,
        description: item.description ?? null,
        contextWindow: item.contextWindow ?? null,
        isDefault: false,
      });
      results.push({ success: true, model });
    } catch {
      results.push({ success: false, modelId: item.modelId });
    }
  }

  const created = results.filter((r) => r.success === true).length;
  const failed = results.filter((r) => r.success === false).length;

  return Response.json(
    { results, created, failed },
    { status: failed > 0 && created === 0 ? 500 : 201 },
  );
}
