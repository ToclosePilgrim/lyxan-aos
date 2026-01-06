import { AgentDispatchJobData } from './agent-dispatch.types';

export type DispatchResult = {
  status: number;
  ok: boolean;
};

export async function dispatchToN8n(params: {
  endpoint: string;
  payload: unknown;
  headers?: Record<string, string>;
  timeoutMs: number;
}): Promise<DispatchResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), params.timeoutMs);
  try {
    const res = await fetch(params.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(params.headers ?? {}),
      },
      body: JSON.stringify(params.payload ?? {}),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Avoid logging payload; include only status for diagnostics
      throw new Error(`n8n responded with non-2xx status: ${res.status}`);
    }
    return { status: res.status, ok: true };
  } finally {
    clearTimeout(t);
  }
}

export function buildN8nHeaders(params: {
  baseHeaders?: Record<string, string>;
  dispatchSecret?: string;
  idempotencyKey?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    ...(params.baseHeaders ?? {}),
  };
  if (params.dispatchSecret) {
    headers['x-aos-dispatch-secret'] = params.dispatchSecret;
  }
  if (params.idempotencyKey) {
    headers['idempotency-key'] = params.idempotencyKey;
  }
  return headers;
}

export function buildDispatchPayload(params: {
  runId: string;
  agentKey: string;
  params: unknown;
}) {
  return {
    runId: params.runId,
    agentKey: params.agentKey,
    params: params.params ?? {},
  } satisfies AgentDispatchJobData['payload'];
}


