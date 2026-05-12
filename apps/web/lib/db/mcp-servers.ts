import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import { type McpServer, type NewMcpServer, mcpServers } from "./schema";

export type McpServerPurpose = McpServer["purpose"];

type McpServerWrite = Omit<NewMcpServer, "id" | "createdAt" | "updatedAt">;

export async function getAllMcpServers(): Promise<McpServer[]> {
  return db
    .select()
    .from(mcpServers)
    .orderBy(mcpServers.purpose, mcpServers.name);
}

export async function getEnabledMcpServers(
  purposes?: McpServerPurpose[],
): Promise<McpServer[]> {
  if (!purposes || purposes.length === 0) {
    return db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.enabled, true))
      .orderBy(mcpServers.purpose, mcpServers.name);
  }

  const rows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.enabled, true))
    .orderBy(mcpServers.purpose, mcpServers.name);

  const allowedPurposes = new Set<McpServerPurpose>(purposes);
  return rows.filter((server) => allowedPurposes.has(server.purpose));
}

export async function getMcpServerById(
  id: string,
): Promise<McpServer | undefined> {
  const [server] = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, id))
    .limit(1);
  return server;
}

export async function createMcpServer(
  data: McpServerWrite,
): Promise<McpServer> {
  const [created] = await db
    .insert(mcpServers)
    .values({
      id: nanoid(),
      ...data,
    })
    .returning();
  if (!created) {
    throw new Error("Failed to create MCP server");
  }
  return created;
}

export async function updateMcpServer(
  id: string,
  data: Partial<McpServerWrite>,
): Promise<McpServer | undefined> {
  const [updated] = await db
    .update(mcpServers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(mcpServers.id, id))
    .returning();
  return updated;
}

export async function setMcpServerEnabled(
  id: string,
  enabled: boolean,
): Promise<McpServer | undefined> {
  const [updated] = await db
    .update(mcpServers)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(mcpServers.id, id))
    .returning();
  return updated;
}

export async function deleteMcpServer(id: string): Promise<boolean> {
  const deleted = await db
    .delete(mcpServers)
    .where(eq(mcpServers.id, id))
    .returning({ id: mcpServers.id });
  return deleted.length > 0;
}
