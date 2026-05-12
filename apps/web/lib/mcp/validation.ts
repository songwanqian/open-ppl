import { z } from "zod";

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

export const mcpHeadersSchema = z
  .record(z.string().trim().min(1), z.string())
  .refine(
    (headers) =>
      Object.entries(headers).every(
        ([key, value]) => key.trim() === key && value.length > 0,
      ),
    "Headers must be a string map with non-empty values",
  );

export function parseHttpMcpUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  if (isPrivateOrLocalHost(url.hostname)) {
    return null;
  }

  return url;
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  if (PRIVATE_IPV4_RANGES.some((range) => range.test(normalized))) {
    return true;
  }

  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  return false;
}
