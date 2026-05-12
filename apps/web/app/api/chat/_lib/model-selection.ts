import type { AgentModelSelection } from "@open-agents/agent";
import { resolveAvailableModelId } from "@/lib/model-availability";
import { type ModelVariant, resolveModelSelection } from "@/lib/model-variants";
import { APP_DEFAULT_MODEL_ID } from "@/lib/models";
import { resolveGatewayConfig } from "@/lib/resolve-gateway-config";

interface ResolveChatModelSelectionParams {
  selectedModelId: string | null | undefined;
  modelVariants: ModelVariant[];
  missingVariantLabel: string;
}

export function resolveChatModelSelection({
  selectedModelId,
  modelVariants,
  missingVariantLabel,
}: ResolveChatModelSelectionParams): AgentModelSelection {
  const requestedModelId = selectedModelId ?? APP_DEFAULT_MODEL_ID;
  const selection = resolveModelSelection(requestedModelId, modelVariants);

  if (selection.isMissingVariant) {
    console.warn(
      `${missingVariantLabel} "${requestedModelId}" was not found. Falling back to default model.`,
    );
    return { id: APP_DEFAULT_MODEL_ID };
  }

  const availableModelId = resolveAvailableModelId(selection.resolvedModelId);
  if (availableModelId !== selection.resolvedModelId) {
    console.warn(
      `${missingVariantLabel} "${requestedModelId}" resolves to disabled model "${selection.resolvedModelId}". Falling back to default model.`,
    );
    return { id: APP_DEFAULT_MODEL_ID };
  }

  return {
    id: availableModelId,
  };
}

export async function resolveChatModelSelectionWithGateway(
  params: ResolveChatModelSelectionParams,
): Promise<AgentModelSelection> {
  const selection = resolveChatModelSelection(params);

  try {
    const gatewayConfig = await resolveGatewayConfig(selection.id);
    if (gatewayConfig) {
      return { ...selection, gatewayConfig };
    }
  } catch {
    // DB unavailable -- proceed without gateway config
  }

  return selection;
}
