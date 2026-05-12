import "server-only";

import { z } from "zod";
import { getEnabledGatewayModels } from "./db/gateway-models";
import { filterDisabledModels } from "./model-availability";
import type {
  AvailableModel,
  AvailableModelCost,
  AvailableModelCostTier,
  GatewayAvailableModel,
} from "./models";

const MODELS_DEV_URL = "https://models.dev/api.json";
const MODELS_DEV_TIMEOUT_MS = 750;
const GITHUB_MODELS_CATALOG_URL = "https://models.github.ai/catalog/models";

type GatewayModel = GatewayAvailableModel;

interface ModelsDevMetadata {
  contextWindow?: number;
  cost?: AvailableModelCost;
}

const recordSchema = z.object({}).catchall(z.unknown());

function getModelsDevCostTier(
  value: unknown,
): AvailableModelCostTier | undefined {
  const parsed = z
    .object({
      input: z.number().finite().optional(),
      output: z.number().finite().optional(),
      cache_read: z.number().finite().optional(),
    })
    .passthrough()
    .safeParse(value);
  if (!parsed.success) {
    return undefined;
  }

  const { input, output, cache_read } = parsed.data;
  if (input === undefined && output === undefined && cache_read === undefined) {
    return undefined;
  }

  return {
    input,
    output,
    cache_read,
  };
}

function getModelsDevCost(value: unknown): AvailableModelCost | undefined {
  const parsed = recordSchema.safeParse(value);
  if (!parsed.success) {
    return undefined;
  }

  const baseCost = getModelsDevCostTier(parsed.data);
  const contextOver200k = getModelsDevCostTier(parsed.data.context_over_200k);

  if (!baseCost && !contextOver200k) {
    return undefined;
  }

  return {
    ...baseCost,
    ...(contextOver200k ? { context_over_200k: contextOver200k } : {}),
  };
}

function getModelsDevMetadataMap(
  data: unknown,
): Map<string, ModelsDevMetadata> {
  const metadataMap = new Map<string, ModelsDevMetadata>();
  const providers = recordSchema.safeParse(data);
  if (!providers.success) {
    return metadataMap;
  }

  for (const [providerKey, providerValue] of Object.entries(providers.data)) {
    const provider = recordSchema.safeParse(providerValue);
    if (!provider.success) {
      continue;
    }

    const models = recordSchema.safeParse(provider.data.models);
    if (!models.success) {
      continue;
    }

    for (const [modelKey, modelValue] of Object.entries(models.data)) {
      const model = recordSchema.safeParse(modelValue);
      if (!model.success) {
        continue;
      }

      const parsedId = z.string().safeParse(model.data.id);
      const rawId = parsedId.success ? parsedId.data : modelKey;
      const modelId = rawId.includes("/") ? rawId : `${providerKey}/${rawId}`;

      const parsedLimit = z
        .object({
          context: z.number().finite().positive().optional(),
        })
        .passthrough()
        .safeParse(model.data.limit);
      const contextWindow = parsedLimit.success
        ? parsedLimit.data.context
        : undefined;
      const cost = getModelsDevCost(model.data.cost);

      if (contextWindow === undefined && cost === undefined) {
        continue;
      }

      metadataMap.set(modelId, {
        contextWindow,
        cost,
      });
    }
  }

  return metadataMap;
}

async function fetchModelsDevMetadataMap(): Promise<
  Map<string, ModelsDevMetadata>
> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODELS_DEV_TIMEOUT_MS);

  try {
    const response = await fetch(MODELS_DEV_URL, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return new Map();
    }
    const data: unknown = await response.json();
    return getModelsDevMetadataMap(data);
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeoutId);
  }
}

function addModelsDevMetadata(
  model: GatewayModel,
  metadataMap: Map<string, ModelsDevMetadata>,
): AvailableModel {
  const metadata = metadataMap.get(model.id);
  if (!metadata) {
    return model;
  }

  const nextModel: AvailableModel = { ...model };

  if (
    typeof metadata.contextWindow === "number" &&
    metadata.contextWindow > 0
  ) {
    nextModel.context_window = metadata.contextWindow;
  }

  if (metadata.cost) {
    nextModel.cost = metadata.cost;
  }

  return nextModel;
}

async function fetchGitHubModelsCatalog(): Promise<GatewayModel[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN environment variable is required for GitHub Models",
    );
  }

  const response = await fetch(GITHUB_MODELS_CATALOG_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2025-04-01",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch GitHub Models catalog: ${response.status}`,
    );
  }

  const data: unknown = await response.json();

  const catalogSchema = z.array(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        task: z.union([z.string(), z.array(z.string())]).optional(),
      })
      .passthrough(),
  );

  const parsed = catalogSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid GitHub Models catalog response");
  }

  return parsed.data.map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
    description: model.description ?? null,
    modelType: "language" as const,
  }));
}

interface GatewayModelsResult {
  models: AvailableModel[];
  fromGateway: boolean;
}

async function fetchAvailableLanguageModelsInternal(): Promise<GatewayModelsResult> {
  let gatewayModelsData: Awaited<ReturnType<typeof getEnabledGatewayModels>> =
    [];
  try {
    gatewayModelsData = await getEnabledGatewayModels();
  } catch {
    // DB unavailable -- fall back to GitHub Models catalog
  }

  if (gatewayModelsData.length > 0) {
    return {
      fromGateway: true,
      models: gatewayModelsData.map((model) => ({
        id: model.modelId,
        name: model.name,
        description: model.description ?? null,
        modelType: "language" as const,
        ...(model.contextWindow ? { context_window: model.contextWindow } : {}),
      })),
    };
  }

  const models = await fetchGitHubModelsCatalog();
  return {
    fromGateway: false,
    models: filterDisabledModels(
      models.filter((model) => model.modelType === "language"),
    ),
  };
}

export async function fetchAvailableLanguageModels(): Promise<
  AvailableModel[]
> {
  const result = await fetchAvailableLanguageModelsInternal();
  return result.models;
}

export async function fetchAvailableLanguageModelsWithContext(): Promise<
  AvailableModel[]
> {
  const result = await fetchAvailableLanguageModelsInternal();

  if (result.fromGateway) {
    return result.models;
  }

  const modelsDevMetadataMap = await fetchModelsDevMetadataMap();
  return result.models.map((model) =>
    addModelsDevMetadata(model, modelsDevMetadataMap),
  );
}
