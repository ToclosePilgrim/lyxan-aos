import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AGENT_DISPATCH_DLQ_TOKEN,
  AGENT_DISPATCH_QUEUE_TOKEN,
} from './agent-dispatch.constants';
import { AgentDispatchDlqData, AgentDispatchJobData } from './agent-dispatch.types';

@Injectable()
export class AgentDispatchQueuesLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(AGENT_DISPATCH_QUEUE_TOKEN)
    private readonly queue: Queue<AgentDispatchJobData>,
    @Inject(AGENT_DISPATCH_DLQ_TOKEN)
    private readonly dlq: Queue<AgentDispatchDlqData>,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled([this.queue.close(), this.dlq.close()]);
  }
}


