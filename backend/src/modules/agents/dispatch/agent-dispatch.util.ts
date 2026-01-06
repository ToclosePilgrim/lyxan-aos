import type { JobsOptions } from 'bullmq';
import { URL } from 'node:url';

export function buildAgentDispatchJobId(params: {
  runId: string;
  workflowKey?: string;
}) {
  const wf = params.workflowKey ? `:${params.workflowKey}` : '';
  return `agent-dispatch${wf}:${params.runId}`;
}

export function buildAgentDispatchJobOptions(params: {
  attempts: number;
  backoffBaseMs: number;
}): JobsOptions {
  return {
    attempts: params.attempts,
    backoff: {
      type: 'exponential',
      delay: params.backoffBaseMs,
    },
    removeOnComplete: true,
    removeOnFail: false,
  };
}

export function parseRedisUrl(redisUrl: string | undefined): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: object;
} {
  const raw = redisUrl ?? 'redis://localhost:6379';
  const u = new URL(raw);
  const host = u.hostname;
  const port = u.port ? Number(u.port) : 6379;
  const username = u.username || undefined;
  const password = u.password || undefined;
  const dbStr = u.pathname?.replace('/', '') ?? '';
  const db = dbStr ? Number(dbStr) : undefined;
  const tls = u.protocol === 'rediss:' ? {} : undefined;
  return { host, port, username, password, db, tls };
}


