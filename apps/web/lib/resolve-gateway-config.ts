import type { GatewayConfig } from "@open-agents/agent";
import { getGatewayAccountById } from "./db/gateway-accounts";
import { getGatewayModelByModelId } from "./db/gateway-models";

export async function resolveGatewayConfig(
  modelId: string,
): Promise<GatewayConfig | undefined> {
  const gatewayModel = await getGatewayModelByModelId(modelId);
  if (!gatewayModel || !gatewayModel.enabled) {
    return undefined;
  }

  const account = await getGatewayAccountById(gatewayModel.gatewayAccountId);
  if (!account || !account.enabled || !account.baseURL) {
    return undefined;
  }

  return {
    baseURL: account.baseURL,
    apiKey: account.apiKey ?? "",
    remoteModelId: gatewayModel.remoteModelId ?? undefined,
  };
}
