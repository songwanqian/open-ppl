import "server-only";

import {
  type GatewayProviderId,
  normalizeGatewayBaseURL,
} from "@/lib/gateway-providers";

export interface RemoteGatewayModel {
  id: string;
  name: string;
}

interface FetchRemoteGatewayModelsOptions {
  provider: GatewayProviderId;
  baseURL: string;
  apiKey?: string | null;
  modelFilter?: string | null;
}

function getModelsUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, "")}/models`;
}

function getStringField(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function toModelRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toRemoteModel(value: unknown): RemoteGatewayModel | null {
  const record = toModelRecord(value);
  if (!record) {
    return null;
  }

  const id = getStringField(record, ["id", "name"]);
  if (!id) {
    return null;
  }

  return {
    id: id.startsWith("models/") ? id.slice("models/".length) : id,
    name: getStringField(record, ["display_name", "displayName", "name"]) ?? id,
  };
}

function extractModelsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  const record = toModelRecord(data);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.data)) {
    return record.data;
  }

  if (Array.isArray(record.models)) {
    return record.models;
  }

  return [];
}

function filterModels(
  models: RemoteGatewayModel[],
  modelFilter?: string | null,
): RemoteGatewayModel[] {
  if (!modelFilter) {
    return models;
  }

  try {
    const regex = new RegExp(modelFilter, "i");
    return models.filter(
      (model) => regex.test(model.id) || regex.test(model.name),
    );
  } catch {
    return models;
  }
}

async function fetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchRemoteGatewayModels({
  provider,
  baseURL,
  apiKey,
  modelFilter,
}: FetchRemoteGatewayModelsOptions): Promise<RemoteGatewayModel[]> {
  const normalizedBaseURL = normalizeGatewayBaseURL(provider, baseURL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
  } else if (provider === "gemini") {
    if (apiKey) {
      headers["x-goog-api-key"] = apiKey;
    }
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const data = await fetchJson(getModelsUrl(normalizedBaseURL), headers);
  const models = extractModelsArray(data)
    .map(toRemoteModel)
    .filter((model): model is RemoteGatewayModel => model !== null);

  return filterModels(models, modelFilter);
}
