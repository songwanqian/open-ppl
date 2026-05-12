import { z } from "zod";
import {
  createGatewayModelVariant,
  getAllGatewayModelVariants,
} from "@/lib/db/gateway-model-variants";
import { providerOptionsSchema } from "@/lib/model-variants";
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
  baseModelId: z.string().trim().min(1),
  providerOptions: providerOptionsSchema.optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const variants = await getAllGatewayModelVariants();
  return Response.json({ variants });
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

  const variant = await createGatewayModelVariant(parsed.data);
  return Response.json({ variant }, { status: 201 });
}
