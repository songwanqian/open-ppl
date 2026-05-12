import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import { type GatewayModel, gatewayModels } from "./schema";

export async function getAllGatewayModels(): Promise<GatewayModel[]> {
  return db.select().from(gatewayModels).orderBy(gatewayModels.name);
}

export async function getEnabledGatewayModels(): Promise<GatewayModel[]> {
  return db
    .select()
    .from(gatewayModels)
    .where(eq(gatewayModels.enabled, true))
    .orderBy(gatewayModels.name);
}

export async function getGatewayModelById(
  id: string,
): Promise<GatewayModel | undefined> {
  const [model] = await db
    .select()
    .from(gatewayModels)
    .where(eq(gatewayModels.id, id))
    .limit(1);
  return model;
}

export async function getGatewayModelByModelId(
  modelId: string,
): Promise<GatewayModel | undefined> {
  const [model] = await db
    .select()
    .from(gatewayModels)
    .where(eq(gatewayModels.modelId, modelId))
    .limit(1);
  return model;
}

export async function createGatewayModel(
  data: Omit<GatewayModel, "id" | "createdAt" | "updatedAt">,
): Promise<GatewayModel> {
  const [created] = await db
    .insert(gatewayModels)
    .values({
      id: nanoid(),
      ...data,
    })
    .returning();
  if (!created) {
    throw new Error("Failed to create gateway model");
  }
  return created;
}

export async function updateGatewayModel(
  id: string,
  data: Partial<Omit<GatewayModel, "id" | "createdAt" | "updatedAt">>,
): Promise<GatewayModel | undefined> {
  const [updated] = await db
    .update(gatewayModels)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(gatewayModels.id, id))
    .returning();
  return updated;
}

export async function deleteGatewayModel(id: string): Promise<boolean> {
  const deleted = await db
    .delete(gatewayModels)
    .where(eq(gatewayModels.id, id))
    .returning({ id: gatewayModels.id });
  return deleted.length > 0;
}
