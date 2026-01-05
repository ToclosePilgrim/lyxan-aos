import { Injectable } from '@nestjs/common';
import { Prisma, ScmComponentProvisionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ProvisioningRecalcService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lightweight stub of provisioning recalculation.
   * Full implementation is not required for supply receiving pipeline tests.
   */
  async recalcForSupply(_supplyId: string, _tx?: Prisma.TransactionClient) {
    return;
  }

  /**
   * MVP: mark OWN_STOCK components as PROVIDED (provisionedQty = planned).
   * This is a minimal, deterministic implementation to unblock production flows
   * while a full reservation-based provisioning engine is being built.
   */
  async recalcForProductionOrder(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const items = await client.productionOrderItem.findMany({
      where: {
        productionOrderId: orderId,
        sourceType: 'OWN_STOCK' as any,
      } as any,
      select: { id: true, quantityPlanned: true },
    });
    for (const it of items) {
      await client.productionOrderItem.update({
        where: { id: it.id },
        data: {
          provisionStatus: ScmComponentProvisionStatus.PROVIDED,
          provisionedQty: it.quantityPlanned,
        },
      });
    }
  }
}
