import { z } from "zod";
import {
  deleteGatewayModel,
  getGatewayModelById,
  updateGatewayModel,
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

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  modelId: z.string().trim().min(1).optional(),
  remoteModelId: z.string().trim().min(1).nullable().optional(),
  gatewayAccountId: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
  description: z.string().nullable().optional(),
  contextWindow: z.number().int().positive().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await getGatewayModelById(id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await updateGatewayModel(id, parsed.data);
  return Response.json({ model: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const deleted = await deleteGatewayModel(id);
  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
