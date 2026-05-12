import { z } from "zod";
import {
  createGatewayAccount,
  getAllGatewayAccounts,
} from "@/lib/db/gateway-accounts";
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
  provider: z.string().trim().min(1),
  baseURL: z.string().trim().min(1),
  apiKey: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const accounts = await getAllGatewayAccounts();
  return Response.json({ accounts });
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

  const account = await createGatewayAccount({
    name: parsed.data.name,
    provider: parsed.data.provider,
    baseURL: parsed.data.baseURL,
    apiKey: parsed.data.apiKey ?? null,
    enabled: parsed.data.enabled,
  });
  return Response.json({ account }, { status: 201 });
}
