import { z } from "zod";
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

const testSchema = z.object({
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

  const { baseURL, apiKey } = parsed.data;
  const modelsUrl = baseURL.replace(/\/+$/, "") + "/models";

  const start = performance.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const latency = Math.round(performance.now() - start);

    if (!response.ok) {
      return Response.json({
        success: false,
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const data: unknown = await response.json();
    const modelsArray = Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null && "data" in data
        ? (data as { data: unknown }).data
        : [];
    const modelCount = Array.isArray(modelsArray) ? modelsArray.length : 0;

    return Response.json({
      success: true,
      latency,
      modelCount,
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
