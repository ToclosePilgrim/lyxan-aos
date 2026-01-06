import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  AGENT_DISPATCH_DLQ_NAME,
  AGENT_DISPATCH_DLQ_TOKEN,
  AGENT_DISPATCH_QUEUE_NAME,
  AGENT_DISPATCH_QUEUE_TOKEN,
} from './agent-dispatch.constants';
import { parseRedisUrl } from './agent-dispatch.util';
import { AgentDispatchService } from './agent-dispatch.service';
import { AgentDispatchWorker } from './agent-dispatch.worker';
import { AgentDispatchDlqData, AgentDispatchJobData } from './agent-dispatch.types';
import { DatabaseModule } from '../../../database/database.module';
import { AgentDispatchQueuesLifecycle } from './agent-dispatch.queues-lifecycle';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    {
      provide: AGENT_DISPATCH_QUEUE_TOKEN,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') ?? process.env.REDIS_URL;
        const connection = parseRedisUrl(redisUrl);
        return new Queue<AgentDispatchJobData>(AGENT_DISPATCH_QUEUE_NAME, {
          connection,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: AGENT_DISPATCH_DLQ_TOKEN,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') ?? process.env.REDIS_URL;
        const connection = parseRedisUrl(redisUrl);
        return new Queue<AgentDispatchDlqData>(AGENT_DISPATCH_DLQ_NAME, {
          connection,
        });
      },
      inject: [ConfigService],
    },
    AgentDispatchService,
    AgentDispatchWorker,
    AgentDispatchQueuesLifecycle,
  ],
  exports: [AgentDispatchService],
})
export class AgentDispatchQueueModule {}


