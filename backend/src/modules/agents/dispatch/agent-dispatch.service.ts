import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AGENT_DISPATCH_QUEUE_TOKEN,
  AGENT_DISPATCH_QUEUE_NAME,
} from './agent-dispatch.constants';
import { AgentDispatchJobData } from './agent-dispatch.types';
import {
  buildAgentDispatchJobId,
  buildAgentDispatchJobOptions,
} from './agent-dispatch.util';
import { ConfigService } from '@nestjs/config';
import { buildN8nHeaders } from './agent-dispatch.processor';

@Injectable()
export class AgentDispatchService {
  private readonly logger = new Logger(AgentDispatchService.name);

  constructor(
    @Inject(AGENT_DISPATCH_QUEUE_TOKEN)
    private readonly queue: Queue<AgentDispatchJobData>,
    private readonly config: ConfigService,
  ) {}

  async enqueue(input: Omit<AgentDispatchJobData, 'headers'> & { headers?: Record<string, string> }) {
    const attempts = Number(
      this.config.get('AGENT_DISPATCH_ATTEMPTS') ?? 5,
    );
    const backoffBaseMs = Number(
      this.config.get('AGENT_DISPATCH_BACKOFF_BASE_MS') ?? 5000,
    );
    const dispatchSecret = this.config.get<string>('N8N_DISPATCH_SECRET') ?? '';

    const jobId = buildAgentDispatchJobId({
      runId: input.runId,
      workflowKey: input.workflowKey,
    });

    const headers = buildN8nHeaders({
      baseHeaders: input.headers,
      dispatchSecret: dispatchSecret || undefined,
      idempotencyKey: input.idempotencyKey ?? input.runId,
    });

    try {
      const job = await this.queue.add(
        AGENT_DISPATCH_QUEUE_NAME,
        {
          ...input,
          headers,
        },
        {
          jobId,
          ...buildAgentDispatchJobOptions({ attempts, backoffBaseMs }),
        },
      );

      this.logger.log(
        `Enqueued agent dispatch job: runId=${input.runId} jobId=${job.id}`,
      );

      return {
        runId: input.runId,
        status: 'QUEUED' as const,
        jobId: job.id,
      };
    } catch (err: any) {
      const msg = String(err?.message ?? err ?? '');
      // BullMQ dedup by jobId: second enqueue throws "Job <id> already exists"
      if (msg.toLowerCase().includes('already exists')) {
        this.logger.warn(
          `Dispatch job already exists (dedup): runId=${input.runId} jobId=${jobId}`,
        );
        return {
          runId: input.runId,
          status: 'QUEUED' as const,
          jobId,
          deduped: true as const,
        };
      }
      throw err;
    }
  }
}


