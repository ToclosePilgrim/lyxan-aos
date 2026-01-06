import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RunAgentDto } from './dto/run-agent.dto';
import { AgentCallbackPayload } from './types/agent-callback-payload.interface';
import { IntegrationLogsService } from '../integration-logs/integration-logs.service';
import { LogSource } from '@prisma/client';
import { AgentDispatchService } from './dispatch/agent-dispatch.service';
import { buildDispatchPayload } from './dispatch/agent-dispatch.processor';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly integrationLogs: IntegrationLogsService,
    private readonly dispatch: AgentDispatchService,
  ) {}

  async runAgent(dto: RunAgentDto) {
    // Find AgentScenario by key
    const scenario = await this.prisma.agentScenario.findUnique({
      where: { key: dto.agent },
    });

    if (!scenario) {
      throw new NotFoundException(
        `Agent scenario with key "${dto.agent}" not found`,
      );
    }

    // Create AgentRun with status QUEUED (async dispatch)
    const agentRun = await this.prisma.agentRun.create({
      data: {
        agentKey: dto.agent,
        scenarioId: scenario.id,
        input: dto.params
          ? (dto.params as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: 'QUEUED',
        startedAt: new Date(),
      },
    });

    this.logger.log(
      `Starting agent run ${agentRun.id} for agent "${dto.agent}"`,
    );

    // Log agent run start if integrationId is provided in params
    if (
      dto.params &&
      typeof dto.params === 'object' &&
      'integrationId' in dto.params
    ) {
      const integrationId = dto.params.integrationId as string | undefined;
      if (integrationId) {
        await this.integrationLogs.info('Agent run started for integration', {
          source: LogSource.AGENT_RUN,
          integrationId,
          agentRunId: agentRun.id,
          details: {
            agent: dto.agent,
            agentKey: dto.agent,
          },
        });
      }
    }

    try {
      const webhookUrl = scenario.endpoint;

      await this.dispatch.enqueue({
        runId: agentRun.id,
        endpoint: webhookUrl,
        workflowKey: dto.agent,
        idempotencyKey: agentRun.id,
        payload: buildDispatchPayload({
          runId: agentRun.id,
          agentKey: dto.agent,
          params: dto.params || {},
        }),
        headers: {},
      });

      return agentRun;
    } catch (error) {
      await this.prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          finishedAt: new Date(),
        },
      });

      throw new BadRequestException(
        `Failed to enqueue agent dispatch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async handleCallback(runId: string, payload: AgentCallbackPayload) {
    // Find AgentRun by id
    const agentRun = await this.prisma.agentRun.findUnique({
      where: { id: runId },
    });

    if (!agentRun) {
      throw new NotFoundException(`Agent run with ID "${runId}" not found`);
    }

    this.logger.log(`Received callback for run ${runId}`);

    // Determine status from payload
    const status = payload.status === 'success' ? 'SUCCESS' : 'ERROR';
    const error =
      payload.status === 'error' ? payload.error || payload.message : null;
    const output = payload.data || payload.result || payload;

    // Update AgentRun
    const updatedRun = await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status,
        output,
        error,
        finishedAt: new Date(),
      },
    });

    this.logger.log(`Updated run ${runId} with status ${status}`);

    // Log agent run completion if integrationId is provided in payload or input
    const integrationId =
      (payload.integrationId as string | undefined) ||
      (agentRun.input &&
      typeof agentRun.input === 'object' &&
      'integrationId' in agentRun.input
        ? (agentRun.input as { integrationId?: string }).integrationId
        : undefined);

    if (integrationId) {
      const level = updatedRun.status === 'SUCCESS' ? 'INFO' : 'ERROR';

      await this.integrationLogs.log({
        level,
        source: LogSource.AGENT_RUN,
        integrationId,
        agentRunId: updatedRun.id,
        message:
          updatedRun.status === 'SUCCESS'
            ? 'Agent run finished successfully'
            : 'Agent run finished with error',
        details: {
          status: updatedRun.status,
          error: payload.error ?? payload.message ?? updatedRun.error,
        },
      });
    }

    return updatedRun;
  }

  async getRuns(filters?: {
    agentKey?: string;
    status?: string;
    limit?: number;
  }) {
    const where: Prisma.AgentRunWhereInput = {};

    if (filters?.agentKey) {
      where.agentKey = filters.agentKey;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const take = filters?.limit ? Math.min(filters.limit, 100) : 50; // Max 100

    const runs = await this.prisma.agentRun.findMany({
      where,
      include: {
        scenario: {
          select: {
            id: true,
            key: true,
            name: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take,
    });

    return runs;
  }
}
