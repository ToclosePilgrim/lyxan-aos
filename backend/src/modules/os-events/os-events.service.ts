import { Injectable } from '@nestjs/common';
import { Prisma, OsEventStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OsEventType } from './os-events.types';

@Injectable()
export class OsEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async emitEvent(
    tx: Prisma.TransactionClient,
    args: {
      type: OsEventType | string;
      version?: number;
      aggregateType?: string | null;
      aggregateId?: string | null;
      payload: any;
      source?: string | null;
    },
  ) {
    return (tx as any).osEvent.create({
      data: {
        type: args.type,
        version: args.version ?? 1,
        aggregateType: args.aggregateType ?? null,
        aggregateId: args.aggregateId ?? null,
        payload: args.payload,
        source: args.source ?? null,
        status: OsEventStatus.PENDING,
      },
    });
  }
}




