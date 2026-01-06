import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import {
  AGENT_DISPATCH_DLQ_NAME,
  AGENT_DISPATCH_DLQ_TOKEN,
  AGENT_DISPATCH_QUEUE_NAME,
  AGENT_DISPATCH_QUEUE_TOKEN,
} from './agent-dispatch.constants';
import { AgentDispatchDlqData, AgentDispatchJobData } from './agent-dispatch.types';
import { dispatchToN8n } from './agent-dispatch.processor';
import { PrismaService } from '../../../database/prisma.service';
import { parseRedisUrl } from './agent-dispatch.util';

@Injectable()
export class AgentDispatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentDispatchWorker.name);
  private worker: Worker<AgentDispatchJobData> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(AGENT_DISPATCH_QUEUE_TOKEN)
    private readonly queue: Queue<AgentDispatchJobData>,
    @Inject(AGENT_DISPATCH_DLQ_TOKEN)
    private readonly dlq: Queue<AgentDispatchDlqData>,
  ) {}

  async onModuleInit() {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
    const enabledRaw =
      this.config.get<string>('AGENT_DISPATCH_WORKER_ENABLED') ??
      process.env.AGENT_DISPATCH_WORKER_ENABLED ??
      (nodeEnv === 'test' ? 'false' : 'true');
    const enabled = String(enabledRaw).toLowerCase() === 'true';
    if (!enabled) {
      this.logger.log('AgentDispatchWorker disabled by config');
      return;
    }

    const concurrency = Number(
      this.config.get('AGENT_DISPATCH_QUEUE_CONCURRENCY') ?? 5,
    );
    const timeoutMs = Number(this.config.get('N8N_HTTP_TIMEOUT_MS') ?? 15000);

    // IMPORTANT: bullmq Worker needs connection options, do not reuse RedisService in test (it is disabled there)
    const redisUrl = this.config.get<string>('REDIS_URL') ?? process.env.REDIS_URL;
    const connection = parseRedisUrl(redisUrl);

    this.worker = new Worker<AgentDispatchJobData>(
      AGENT_DISPATCH_QUEUE_NAME,
      async (job: Job<AgentDispatchJobData>) => this.processJob(job, timeoutMs),
      { connection, concurrency },
    );

    this.worker.on('failed', async (job, err) => {
      await this.handleFailed(job, err);
    });

    this.worker.on('completed', (job) => {
      if (!job) return;
      this.logger.log(
        `Dispatch completed: runId=${job.data.runId} jobId=${job.id}`,
      );
    });

    this.logger.log(
      `AgentDispatchWorker started: queue=${AGENT_DISPATCH_QUEUE_NAME} concurrency=${concurrency} timeoutMs=${timeoutMs}`,
    );
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    // Queues are closed by module providers (if implemented there); keep worker clean-up here.
  }

  async processJob(job: Job<AgentDispatchJobData>, timeoutMs: number) {
    const { runId, endpoint, payload, headers } = job.data;

    this.logger.log(
      `Dispatching to n8n: runId=${runId} jobId=${job.id} attempt=${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`,
    );

    await dispatchToN8n({
      endpoint,
      payload,
      headers,
      timeoutMs,
    });

    await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: 'RUNNING',
      },
    });

    return { ok: true };
  }

  async handleFailed(job: Job<AgentDispatchJobData> | undefined | null, err: any) {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const attemptsMade = job.attemptsMade;
    const isFinal = attemptsMade >= attempts;

    this.logger.error(
      `Dispatch failed: runId=${job.data.runId} jobId=${job.id} attemptsMade=${attemptsMade}/${attempts} final=${isFinal} error=${err?.message}`,
    );

    if (!isFinal) {
      return; // BullMQ will retry
    }

    try {
      await this.prisma.agentRun.update({
        where: { id: job.data.runId },
        data: {
          status: 'ERROR',
          error: err?.message ?? 'Agent dispatch failed',
          finishedAt: new Date(),
        },
      });
    } catch (e: any) {
      this.logger.error(
        `Failed to update AgentRun after dispatch failure: runId=${job.data.runId} error=${e?.message ?? e}`,
      );
    }

    const dlqPayload: AgentDispatchDlqData = {
      failedAt: new Date().toISOString(),
      original: job.data,
      job: {
        id: job.id ?? null,
        name: job.name,
        attemptsMade,
        attempts,
      },
      error: {
        message: String(err?.message ?? err ?? 'Unknown error'),
        stack: err?.stack,
        name: err?.name,
      },
    };

    await this.dlq.add(AGENT_DISPATCH_DLQ_NAME, dlqPayload, {
      jobId: `agent-dispatch-dlq:${job.data.runId}:${Date.now()}`,
      removeOnComplete: true,
    });
  }
}


