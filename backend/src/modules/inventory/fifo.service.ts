import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, StockMovement } from '@prisma/client';
import { CurrencyRateService } from '../finance/currency-rates/currency-rate.service';
import {
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from './inventory.enums';

type Decimalish = Prisma.Decimal | number | string;
type DbClient = PrismaService | Prisma.TransactionClient;

export class InsufficientStockException extends BadRequestException {
  constructor(
    public readonly itemId: string,
    public readonly warehouseId: string,
    public readonly availableQty: Prisma.Decimal,
    public readonly requestedQty: Prisma.Decimal,
  ) {
    super(
      `Insufficient stock for item ${itemId} in warehouse ${warehouseId}. ` +
        `Available: ${availableQty.toString()}, requested: ${requestedQty.toString()}`,
    );
  }
}

@Injectable()
export class FifoInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
  ) {}

  private toDecimal(value: Decimalish): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  // Helper mapping for future movement types:
  // - SCRAP / LOSS are outcome (reduce stock)
  // - ADJUSTMENT is income if qty > 0, outcome if qty < 0
  // Other legacy types (INCOME/OUTCOME/PRODUCTION_OUTPUT/TRANSFER_IN etc.) are treated accordingly.
  private isIncomeMovementType(
    type: InventoryMovementType,
    quantity?: Decimalish,
  ): boolean {
    if (type === InventoryMovementType.ADJUSTMENT) {
      return quantity ? this.toDecimal(quantity).gt(0) : false;
    }
    return type === InventoryMovementType.INCOME;
  }

  private isOutcomeMovementType(
    type: InventoryMovementType,
    quantity?: Decimalish,
  ): boolean {
    if (type === InventoryMovementType.ADJUSTMENT) {
      return quantity ? this.toDecimal(quantity).lt(0) : false;
    }
    return (
      type === InventoryMovementType.OUTCOME ||
      type === InventoryMovementType.SCRAP ||
      type === InventoryMovementType.LOSS
    );
  }

  async getAvailableStock(
    itemId: string,
    warehouseId?: string,
  ): Promise<Prisma.Decimal> {
    const where: Prisma.StockBatchWhereInput = { itemId };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    const batches = await this.prisma.stockBatch.findMany({
      where,
      select: { quantity: true },
    });
    return batches.reduce(
      (sum: Prisma.Decimal, b) => sum.add(b.quantity),
      new Prisma.Decimal(0),
    );
  }

  async recordIncome(args: {
    itemId: string;
    warehouseId: string;
    quantity: Decimalish;
    costPerUnit?: Decimalish; // legacy name
    unitCost?: Decimalish; // preferred alias
    currency: string;
    docType: InventoryDocumentType;
    docId?: string;
    batchSourceType: InventoryBatchSourceType;
    productionBatchId?: string | null;
    supplyReceiptId?: string | null;
    meta?: Record<string, unknown>;
    tx?: Prisma.TransactionClient;
    movementType?: InventoryMovementType;
    occurredAt?: Date;
    breakdown?: {
      baseUnitCost?: Decimalish;
      logisticsUnitCost?: Decimalish;
      customsUnitCost?: Decimalish;
      inboundUnitCost?: Decimalish;
    };
  }) {
    const quantity = this.toDecimal(args.quantity);
    const landedUnitCost =
      args.unitCost !== undefined
        ? this.toDecimal(args.unitCost)
        : args.costPerUnit !== undefined
          ? this.toDecimal(args.costPerUnit)
          : undefined;
    if (!landedUnitCost || landedUnitCost.lte(0) || quantity.lte(0)) {
      throw new BadRequestException(
        'Income quantity must be greater than zero',
      );
    }

    const baseUnitCost =
      args.breakdown?.baseUnitCost !== undefined
        ? this.toDecimal(args.breakdown.baseUnitCost)
        : landedUnitCost;
    const logisticsUnitCost =
      args.breakdown?.logisticsUnitCost !== undefined
        ? this.toDecimal(args.breakdown.logisticsUnitCost)
        : new Prisma.Decimal(0);
    const customsUnitCost =
      args.breakdown?.customsUnitCost !== undefined
        ? this.toDecimal(args.breakdown.customsUnitCost)
        : new Prisma.Decimal(0);
    const inboundUnitCost =
      args.breakdown?.inboundUnitCost !== undefined
        ? this.toDecimal(args.breakdown.inboundUnitCost)
        : new Prisma.Decimal(0);

    const client: DbClient = args.tx ?? this.prisma;
    const occurredAt = args.occurredAt ? new Date(args.occurredAt) : new Date();
    const unitCostBase = await this.currencyRates.convertToBase({
      amount: landedUnitCost,
      currency: args.currency,
      date: occurredAt,
    });

    const batch = await client.stockBatch.create({
      data: {
        itemId: args.itemId,
        warehouseId: args.warehouseId,
        quantity,
        costPerUnit: landedUnitCost,
        unitCostBase,
        baseUnitCost,
        logisticsUnitCost,
        customsUnitCost,
        inboundUnitCost,
        currency: args.currency || 'RUB',
        sourceType: args.batchSourceType,
        sourceDocId: args.docId ?? null,
      },
    });

    const movement = await client.stockMovement.create({
      data: {
        batchId: batch.id,
        itemId: args.itemId,
        warehouseId: args.warehouseId,
        quantity,
        costPerUnit: landedUnitCost,
        currency: args.currency || 'RUB',
        movementType: args.movementType ?? InventoryMovementType.INCOME,
        docType: args.docType,
        docId: args.docId ?? null,
        supplyReceiptId: args.supplyReceiptId ?? null,
        productionBatchId: args.productionBatchId ?? null,
        meta:
          args.meta || args.breakdown
            ? (JSON.parse(
                JSON.stringify({
                  ...(args.meta ?? {}),
                  unitCostBreakdown: {
                    baseUnitCost: baseUnitCost.toString(),
                    logisticsUnitCost: logisticsUnitCost.toString(),
                    customsUnitCost: customsUnitCost.toString(),
                    inboundUnitCost: inboundUnitCost.toString(),
                  },
                  occurredAt: occurredAt.toISOString(),
                }),
              ) as Prisma.InputJsonValue)
            : undefined,
      },
    });

    return movement;
  }

  async recordOutcome(args: {
    itemId: string;
    warehouseId: string;
    quantity: Decimalish;
    docType: InventoryDocumentType;
    docId?: string;
    allowNegative?: boolean;
    tx?: Prisma.TransactionClient;
    meta?: Record<string, unknown>;
    consumptionOperationId?: string;
    movementType?: InventoryMovementType;
  }): Promise<{
    totalQuantity: Prisma.Decimal;
    totalCost: Prisma.Decimal;
    currency: string;
    movements: StockMovement[];
  }> {
    const required = this.toDecimal(args.quantity);
    if (required.lte(0)) {
      throw new BadRequestException(
        'Outcome quantity must be greater than zero',
      );
    }

    const client: DbClient = args.tx ?? this.prisma;

    const batches = await client.stockBatch.findMany({
      where: {
        itemId: args.itemId,
        warehouseId: args.warehouseId,
        quantity: { gt: 0 },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let remaining = required;
    const movements: StockMovement[] = [];
    let totalCost = new Prisma.Decimal(0);
    let currency = 'RUB';

    for (const batch of batches) {
      if (remaining.lte(0)) break;
      const available = new Prisma.Decimal(batch.quantity);
      const consume = Prisma.Decimal.min(available, remaining);

      await client.stockBatch.update({
        where: { id: batch.id },
        data: {
          quantity: new Prisma.Decimal(batch.quantity).minus(consume),
        },
      });

      const mv = await client.stockMovement.create({
        data: {
          batchId: batch.id,
          itemId: args.itemId,
          warehouseId: args.warehouseId,
          quantity: consume.negated(),
          costPerUnit: batch.costPerUnit,
          currency: batch.currency,
          movementType: args.movementType ?? InventoryMovementType.OUTCOME,
          docType: args.docType,
          docId: args.docId ?? null,
          meta: args.meta
            ? (JSON.parse(JSON.stringify(args.meta)) as Prisma.InputJsonValue)
            : undefined,
          consumptionOperationId: args.consumptionOperationId ?? null,
        },
      });

      movements.push(mv);
      totalCost = totalCost.add(
        new Prisma.Decimal(batch.costPerUnit).mul(consume),
      );
      currency = batch.currency || currency;
      remaining = remaining.minus(consume);
    }

    if (remaining.gt(0)) {
      if (!args.allowNegative) {
        const availableTotal = required.minus(remaining);
        throw new InsufficientStockException(
          args.itemId,
          args.warehouseId,
          availableTotal,
          required,
        );
      }

      const mv = await client.stockMovement.create({
        data: {
          batchId: null,
          itemId: args.itemId,
          warehouseId: args.warehouseId,
          quantity: remaining.negated(),
          costPerUnit: null,
          currency: 'RUB',
          movementType: args.movementType ?? InventoryMovementType.OUTCOME,
          docType: args.docType,
          docId: args.docId ?? null,
          meta: args.meta
            ? (JSON.parse(JSON.stringify(args.meta)) as Prisma.InputJsonValue)
            : undefined,
          consumptionOperationId: args.consumptionOperationId ?? null,
        },
      });
      movements.push(mv);
    }

    return {
      totalQuantity: required,
      totalCost,
      currency,
      movements,
    };
  }
}
