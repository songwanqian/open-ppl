import {
  BUILT_IN_VARIANTS,
  type ModelVariant,
} from "@/lib/model-variants";
import {
  getEnabledGatewayModelVariants,
  toModelVariant,
} from "./db/gateway-model-variants";

export async function getBuiltInVariantsFromDB(): Promise<ModelVariant[]> {
  try {
    const rows = await getEnabledGatewayModelVariants();
    return rows.map(toModelVariant);
  } catch {
    return [];
  }
}

export async function getAllVariantsAsync(
  userVariants: ModelVariant[],
): Promise<ModelVariant[]> {
  const builtIn = await getBuiltInVariantsFromDB();
  return [...builtIn, ...userVariants];
}

export function getAllVariants(userVariants: ModelVariant[]): ModelVariant[] {
  return [...BUILT_IN_VARIANTS, ...userVariants];
}
