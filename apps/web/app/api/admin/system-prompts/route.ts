import { z } from "zod";
import {
  createSystemPrompt,
  getAllSystemPrompts,
} from "@/lib/db/system-prompts";
import { requireAdmin } from "../_lib/require-admin";

const createSchema = z.object({
  name: z.string().trim().min(1),
  mode: z.enum(["computer", "search"]),
  content: z.string().trim().min(1),
  enabled: z.boolean().optional().default(true),
});

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const prompts = await getAllSystemPrompts();
  return Response.json({ prompts });
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

  const prompt = await createSystemPrompt(parsed.data);
  return Response.json({ prompt }, { status: 201 });
}
