import { getGatewayAccountById } from "@/lib/db/gateway-accounts";
import { getServerSession } from "@/lib/session/get-server-session";
import { isUserAdmin } from "@/lib/db/users";
import { fetchRemoteGatewayModels } from "@/lib/gateway-remote-models";
import { normalizeGatewayProvider } from "@/lib/gateway-providers";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const account = await getGatewayAccountById(id);
  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  const provider = normalizeGatewayProvider(account.provider);
  if (!provider) {
    return Response.json(
      { error: `Unsupported provider: ${account.provider}` },
      { status: 400 },
    );
  }

  try {
    const models = await fetchRemoteGatewayModels({
      provider,
      baseURL: account.baseURL,
      apiKey: account.apiKey,
      modelFilter: account.modelFilter,
    });
    return Response.json({ models });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch models";
    return Response.json({ error: message }, { status: 502 });
  }
}
