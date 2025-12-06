import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LogLevel, LogSource, Prisma } from '@prisma/client';

interface LogParams {
  level: LogLevel;
  source: LogSource;
  message: string;
  integrationId?: string;
  agentRunId?: string;
  details?: unknown;
}

@Injectable()
export class IntegrationLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogParams) {
    const { level, source, message, integrationId, agentRunId, details } = params;

    return this.prisma.integrationLog.create({
      data: {
        level,
        source,
        message,
        integrationId: integrationId ?? null,
        agentRunId: agentRunId ?? null,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async info(
    message: string,
    context: Omit<LogParams, 'level' | 'source' | 'message'> & { source: LogSource },
  ) {
    return this.log({ level: 'INFO', message, ...context });
  }

  async warn(
    message: string,
    context: Omit<LogParams, 'level' | 'source' | 'message'> & { source: LogSource },
  ) {
    return this.log({ level: 'WARN', message, ...context });
  }

  async error(
    message: string,
    context: Omit<LogParams, 'level' | 'source' | 'message'> & { source: LogSource },
  ) {
    return this.log({ level: 'ERROR', message, ...context });
  }
}





