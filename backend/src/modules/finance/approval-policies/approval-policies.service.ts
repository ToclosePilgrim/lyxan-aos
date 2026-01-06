import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentRequestType, Prisma } from '@prisma/client';

@Injectable()
export class ApprovalPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: {
    legalEntityId: string;
    type: PaymentRequestType;
    amountBaseFrom: string;
    amountBaseTo?: string | null;
    approverRole: string;
    isAutoApprove?: boolean;
  }) {
    // Minimal: no idempotency contract here; tests should pass unique combos if needed.
    return (this.prisma as any).financeApprovalPolicy.create({
      data: {
        legalEntityId: dto.legalEntityId,
        type: dto.type,
        amountBaseFrom: new Prisma.Decimal(dto.amountBaseFrom),
        amountBaseTo: dto.amountBaseTo
          ? new Prisma.Decimal(dto.amountBaseTo)
          : null,
        approverRole: dto.approverRole,
        isAutoApprove: dto.isAutoApprove ?? false,
      } as any,
    });
  }
}




