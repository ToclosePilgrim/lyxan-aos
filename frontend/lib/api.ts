import { apiFetch } from "@/lib/api-client";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  /**
   * If `body` is a plain object, it will be JSON.stringified and Content-Type set to application/json.
   * If `body` is a string / FormData / Blob, it's passed as-is.
   */
  body?: unknown;
};

function normalizeBody(body: unknown): { body?: BodyInit; headers?: HeadersInit } {
  if (body === undefined) return {};
  if (typeof body === "string") return { body };
  if (body instanceof FormData) return { body };
  if (body instanceof Blob) return { body };
  if (body instanceof ArrayBuffer) return { body: body as unknown as BodyInit };

  // default: JSON
  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  };
}

/**
 * API wrapper for client components.
 * - Uses cookie-based auth (credentials included) via `apiFetch`
 * - Accepts `body` as plain object (auto-json)
 * - Throws Error with meaningful message on non-2xx
 */
export async function apiRequest<T = any>(
  path: string,
  options?: ApiRequestOptions,
): Promise<T> {
  const { body, ...rest } = options ?? {};
  const normalized = normalizeBody(body);

  return apiFetch(path, {
    ...rest,
    ...(normalized.body !== undefined ? { body: normalized.body } : {}),
    headers: {
      ...(normalized.headers ?? {}),
      ...(rest.headers ?? {}),
    },
  }) as Promise<T>;
}

