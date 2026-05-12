import { z } from "zod";
import {
  createGatewayModel,
  getAllGatewayModels,
} from "@/lib/db/gateway-models";
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

const createSchema = z.object({
  name: z.string().trim().min(1),
  modelId: z.string().trim().min(1),
  gatewayAccountId: z.string().trim().min(1),
  enabled: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
  contextWindow: z.number().int().positive().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const models = await getAllGatewayModels();
  return Response.json({ models });
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const model = await createGatewayModel({
    name: parsed.data.name,
    modelId: parsed.data.modelId,
    gatewayAccountId: parsed.data.gatewayAccountId,
    enabled: parsed.data.enabled,
    description: parsed.data.description ?? null,
    contextWindow: parsed.data.contextWindow ?? null,
    isDefault: parsed.data.isDefault,
  });
  return Response.json({ model }, { status: 201 });
}
