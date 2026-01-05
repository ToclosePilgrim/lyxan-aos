import { Injectable } from '@nestjs/common';
import { Prisma, StockReservationForType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FifoInventoryService } from './fifo.service';

@Injectable()
export class StockReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fifoInventoryService: FifoInventoryService,
  ) {}

  private toDecimal(v: Prisma.Decimal | number | string) {
    return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
  }

  async releaseReservationsForProductionOrder(orderId: string) {
    await this.prisma.stockReservation.deleteMany({
      where: {
        reservedForType: StockReservationForType.PRODUCTION_ORDER,
        reservedForId: orderId,
      },
    });
  }

  async decreaseReservationForProductionConsumption(
    params: {
      productionOrderId: string;
      itemId: string;
      warehouseId: string;
      quantity: Prisma.Decimal | number | string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const qty = this.toDecimal(params.quantity);
    if (qty.lte(0)) return;
    const reservation = await client.stockReservation.findFirst({
      where: {
        reservedForType: StockReservationForType.PRODUCTION_ORDER,
        reservedForId: params.productionOrderId,
        productionOrderId: params.productionOrderId,
        itemId: params.itemId,
        warehouseId: params.warehouseId,
      },
    });
    if (!reservation) return;
    const newQty = new Prisma.Decimal(reservation.quantity).sub(qty);
    if (newQty.lte(0)) {
      await client.stockReservation.delete({ where: { id: reservation.id } });
    } else {
      await client.stockReservation.update({
        where: { id: reservation.id },
        data: { quantity: newQty },
      });
    }
  }

  async getAvailableToReserve(params: { itemId: string; warehouseId: string }) {
    const onHand = await this.fifoInventoryService.getAvailableStock(
      params.itemId,
      params.warehouseId,
    );
    const agg = await this.prisma.stockReservation.aggregate({
      where: {
        itemId: params.itemId,
        warehouseId: params.warehouseId,
      },
      _sum: { quantity: true },
    });
    const reserved = agg._sum.quantity
      ? new Prisma.Decimal(agg._sum.quantity)
      : new Prisma.Decimal(0);
    const available = onHand.sub(reserved);
    return available.isNegative() ? new Prisma.Decimal(0) : available;
  }
}
