import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  BUILT_IN_VARIANT_ID_PREFIX,
  type JsonValue,
  type ModelVariant,
} from "@/lib/model-variants";
import { db } from "./client";
import { type GatewayModelVariant, gatewayModelVariants } from "./schema";

export async function getEnabledGatewayModelVariants(): Promise<
  GatewayModelVariant[]
> {
  return db
    .select()
    .from(gatewayModelVariants)
    .where(eq(gatewayModelVariants.enabled, true))
    .orderBy(gatewayModelVariants.name);
}

export async function getAllGatewayModelVariants(): Promise<
  GatewayModelVariant[]
> {
  return db
    .select()
    .from(gatewayModelVariants)
    .orderBy(gatewayModelVariants.name);
}

export async function getGatewayModelVariantById(
  id: string,
): Promise<GatewayModelVariant | undefined> {
  const [variant] = await db
    .select()
    .from(gatewayModelVariants)
    .where(eq(gatewayModelVariants.id, id))
    .limit(1);
  return variant;
}

export function toModelVariant(row: GatewayModelVariant): ModelVariant {
  return {
    id: row.id,
    name: row.name,
    baseModelId: row.baseModelId,
    providerOptions: (row.providerOptions ?? {}) as Record<string, JsonValue>,
  };
}

export async function createGatewayModelVariant(data: {
  name: string;
  baseModelId: string;
  providerOptions?: Record<string, JsonValue>;
  enabled?: boolean;
}): Promise<GatewayModelVariant> {
  const [created] = await db
    .insert(gatewayModelVariants)
    .values({
      id: `${BUILT_IN_VARIANT_ID_PREFIX}${nanoid()}`,
      name: data.name,
      baseModelId: data.baseModelId,
      providerOptions: data.providerOptions ?? {},
      enabled: data.enabled ?? true,
    })
    .returning();
  if (!created) {
    throw new Error("Failed to create gateway model variant");
  }
  return created;
}

export async function updateGatewayModelVariant(
  id: string,
  data: {
    name?: string;
    baseModelId?: string;
    providerOptions?: Record<string, JsonValue>;
    enabled?: boolean;
  },
): Promise<GatewayModelVariant | undefined> {
  const [updated] = await db
    .update(gatewayModelVariants)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(gatewayModelVariants.id, id))
    .returning();
  return updated;
}

export async function deleteGatewayModelVariant(id: string): Promise<boolean> {
  const deleted = await db
    .delete(gatewayModelVariants)
    .where(eq(gatewayModelVariants.id, id))
    .returning({ id: gatewayModelVariants.id });
  return deleted.length > 0;
}
