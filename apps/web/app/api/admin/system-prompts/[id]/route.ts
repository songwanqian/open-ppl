import { z } from "zod";
import {
  deleteSystemPrompt,
  getSystemPromptById,
  updateSystemPrompt,
} from "@/lib/db/system-prompts";
import { requireAdmin } from "../../_lib/require-admin";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  mode: z.enum(["computer", "search"]).optional(),
  content: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await getSystemPromptById(id);
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

  const prompt = await updateSystemPrompt(id, parsed.data);
  return Response.json({ prompt });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const deleted = await deleteSystemPrompt(id);
  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
