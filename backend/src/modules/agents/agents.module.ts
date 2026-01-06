import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { IntegrationLogsModule } from '../integration-logs/integration-logs.module';
import { AgentsCallbackHmacGuard } from './guards/agents-callback-hmac.guard';
import { AgentDispatchQueueModule } from './dispatch/agent-dispatch.module';

@Module({
  imports: [IntegrationLogsModule, AgentDispatchQueueModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentsCallbackHmacGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
