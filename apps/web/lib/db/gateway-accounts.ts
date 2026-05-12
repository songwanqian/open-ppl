import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import { type GatewayAccount, gatewayAccounts } from "./schema";

export async function getAllGatewayAccounts(): Promise<GatewayAccount[]> {
  return db.select().from(gatewayAccounts).orderBy(gatewayAccounts.name);
}

export async function getEnabledGatewayAccounts(): Promise<GatewayAccount[]> {
  return db
    .select()
    .from(gatewayAccounts)
    .where(eq(gatewayAccounts.enabled, true))
    .orderBy(gatewayAccounts.name);
}

export async function getGatewayAccountById(
  id: string,
): Promise<GatewayAccount | undefined> {
  const [account] = await db
    .select()
    .from(gatewayAccounts)
    .where(eq(gatewayAccounts.id, id))
    .limit(1);
  return account;
}

export async function createGatewayAccount(
  data: Omit<GatewayAccount, "id" | "createdAt" | "updatedAt">,
): Promise<GatewayAccount> {
  const [created] = await db
    .insert(gatewayAccounts)
    .values({
      id: nanoid(),
      ...data,
    })
    .returning();
  if (!created) {
    throw new Error("Failed to create gateway account");
  }
  return created;
}

export async function updateGatewayAccount(
  id: string,
  data: Partial<Omit<GatewayAccount, "id" | "createdAt" | "updatedAt">>,
): Promise<GatewayAccount | undefined> {
  const [updated] = await db
    .update(gatewayAccounts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(gatewayAccounts.id, id))
    .returning();
  return updated;
}

export async function deleteGatewayAccount(id: string): Promise<boolean> {
  const deleted = await db
    .delete(gatewayAccounts)
    .where(eq(gatewayAccounts.id, id))
    .returning({ id: gatewayAccounts.id });
  return deleted.length > 0;
}
