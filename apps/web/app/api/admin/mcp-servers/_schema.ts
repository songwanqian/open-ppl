import { z } from "zod";
import { mcpHeadersSchema, parseHttpMcpUrl } from "@/lib/mcp/validation";

const urlSchema = z.string().trim().min(1).refine(parseHttpMcpUrl, {
  message: "URL must be public http(s)",
});

export const createMcpServerSchema = z.object({
  name: z.string().trim().min(1),
  purpose: z.enum(["search", "web_fetch", "general"]),
  url: urlSchema,
  headers: mcpHeadersSchema.optional().default({}),
  enabled: z.boolean().optional().default(true),
});

export const updateMcpServerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  purpose: z.enum(["search", "web_fetch", "general"]).optional(),
  url: urlSchema.optional(),
  headers: mcpHeadersSchema.optional(),
  enabled: z.boolean().optional(),
});
