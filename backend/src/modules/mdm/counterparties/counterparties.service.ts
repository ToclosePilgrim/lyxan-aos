import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Counterparty, CounterpartyRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CounterpartiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    name: string;
    code?: string;
    roles: CounterpartyRole[];
  }): Promise<Counterparty> {
    const code = input.code?.trim() || `CP-${randomUUID().slice(0, 8)}`;
    return this.prisma.counterparty.create({
      data: {
        name: input.name,
        code,
        roles: input.roles,
      },
    });
  }
}




