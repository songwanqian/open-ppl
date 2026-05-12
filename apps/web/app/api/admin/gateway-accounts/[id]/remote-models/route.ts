import { getGatewayAccountById } from "@/lib/db/gateway-accounts";
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

interface RemoteModel {
  id: string;
  name: string;
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

  const modelsUrl = account.baseURL.replace(/\/+$/, "") + "/models";

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (account.apiKey) {
      headers["Authorization"] = `Bearer ${account.apiKey}`;
    }

    const response = await fetch(modelsUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return Response.json(
        { error: `Failed to fetch models: HTTP ${response.status}` },
        { status: 502 },
      );
    }

    const data: unknown = await response.json();
    const rawModels: unknown[] = Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null && "data" in data
        ? (data as { data: unknown[] }).data
        : [];

    let models: RemoteModel[] = rawModels
      .filter(
        (m): m is Record<string, unknown> =>
          typeof m === "object" && m !== null,
      )
      .map((m) => ({
        id: typeof m.id === "string" ? m.id : String(m.id ?? ""),
        name:
          typeof m.name === "string"
            ? m.name
            : typeof m.id === "string"
              ? m.id
              : "",
      }))
      .filter((m) => m.id);

    if (account.modelFilter) {
      try {
        const regex = new RegExp(account.modelFilter, "i");
        models = models.filter((m) => regex.test(m.id) || regex.test(m.name));
      } catch {
        // Invalid regex — skip filtering
      }
    }

    return Response.json({ models });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch models";
    return Response.json({ error: message }, { status: 502 });
  }
}
