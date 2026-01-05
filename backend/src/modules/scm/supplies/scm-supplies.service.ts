import * as common_1 from '@nestjs/common';
import * as client_1 from '@prisma/client';
import * as accounting_accounts_config_1 from '../../finance/accounting-accounts.config';
import * as inventory_enums_1 from '../../inventory/inventory.enums';
import * as os_events_types_1 from '../../os-events/os-events.types';
import * as scope_validation_1 from '../../../common/scope/scope.validation';
import * as crypto_1 from 'node:crypto';

import { PrismaService } from '../../../database/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { ProvisioningRecalcService } from '../production-orders/provisioning-recalc.service';
import { FifoInventoryService } from '../../inventory/fifo.service';
import { InventoryOrchestratorService } from '../../inventory/inventory-orchestrator.service';
import { FinancialDocumentsService } from '../../finance/documents/financial-documents.service';
import { AccountingEntryService } from '../../finance/accounting-entry/accounting-entry.service';
import { InventoryAccountingLinkService } from '../../finance/inventory-accounting-link.service';
import { PostingRunsService } from '../../finance/posting-runs/posting-runs.service';
import { OsEventsService } from '../../os-events/os-events.service';
import { AccountingValidationService } from '../../finance/accounting-validation.service';
import { MdmItemsService } from '../../mdm/items/mdm-items.service';
import { MdmOffersService } from '../../mdm/offers/mdm-offers.service';

@common_1.Injectable()
export class ScmSuppliesService {
  prisma;
  inventoryService;
  fifo;
  inventoryOrchestrator;
  mdmItems;
  mdmOffers;
  provisioningRecalc;
  financialDocuments;
  accountingEntries;
  accountingValidation;
  inventoryAccountingLink;
  osEvents;
  postingRuns;
  constructor(
    prisma: PrismaService,
    inventoryService: InventoryService,
    fifo: FifoInventoryService,
    inventoryOrchestrator: InventoryOrchestratorService,
    mdmItems: MdmItemsService,
    mdmOffers: MdmOffersService,
    provisioningRecalc: ProvisioningRecalcService,
    financialDocuments: FinancialDocumentsService,
    accountingEntries: AccountingEntryService,
    accountingValidation: AccountingValidationService,
    inventoryAccountingLink: InventoryAccountingLinkService,
    osEvents: OsEventsService,
    postingRuns: PostingRunsService,
  ) {
    this.prisma = prisma;
    this.inventoryService = inventoryService;
    this.fifo = fifo;
    this.inventoryOrchestrator = inventoryOrchestrator;
    this.mdmItems = mdmItems;
    this.mdmOffers = mdmOffers;
    this.provisioningRecalc = provisioningRecalc;
    this.financialDocuments = financialDocuments;
    this.accountingEntries = accountingEntries;
    this.accountingValidation = accountingValidation;
    this.inventoryAccountingLink = inventoryAccountingLink;
    this.osEvents = osEvents;
    this.postingRuns = postingRuns;
  }
  BatchSource =
    client_1.BatchSourceType ??
    (client_1 as any).Prisma?.$Enums?.BatchSourceType;
  MovementType =
    client_1.MovementType ?? (client_1 as any).Prisma?.$Enums?.MovementType;
  MovementDocType =
    client_1.MovementDocType ??
    (client_1 as any).Prisma?.$Enums?.MovementDocType;
  SupplyStatus =
    client_1.ScmSupplyStatus ??
    (client_1 as any).Prisma?.$Enums?.ScmSupplyStatus;

  async receiveSupplyInternal(tx, params) {
    const { supply, lines, receivedAt, comment } = params;
    if (!supply.warehouseId) {
      throw new common_1.BadRequestException(
        'Supply must have a warehouseId to receive',
      );
    }
    if (supply.status === client_1.ScmSupplyStatus.RECEIVED) {
      throw new common_1.BadRequestException('Supply is already RECEIVED');
    }
    if (!lines || lines.length === 0) {
      throw new common_1.BadRequestException('Nothing to receive');
    }
    const currency = (
      lines[0]?.currency ||
      supply.currency ||
      'RUB'
    ).toUpperCase();
    for (const l of lines) {
      if ((l.currency || currency).toUpperCase() !== currency) {
        throw new common_1.BadRequestException(
          'All receipt lines must have the same currency',
        );
      }
    }
    const receiptDate = receivedAt ?? new Date();
    const now = new Date();
    const receipt = await tx.scmSupplyReceipt.create({
      data: {
        id: (0, crypto_1.randomUUID)(),
        updatedAt: now,
        supplyId: supply.id,
        currency,
        receivedAt: receiptDate,
        comment: comment ?? null,
      },
    });
    const lineBreakdown: Array<{
      supplyItemId: string;
      itemId: string;
      quantity: string;
      landedUnitCost: string;
      amount: string;
      movementId: string;
    }> = [];
    const movementIds: string[] = [];
    let total = new client_1.Prisma.Decimal(0);
    for (const l of lines) {
      const item = l.item;
      const qty = new client_1.Prisma.Decimal(l.quantity);
      if (qty.lte(0)) continue;
      const currentTotal =
        item.quantityReceived?.toNumber?.() ?? item.quantityReceived ?? 0;
      const newTotal = new client_1.Prisma.Decimal(currentTotal).add(qty);
      if (newTotal.gt(item.quantityOrdered)) {
        throw new common_1.BadRequestException(
          'Cannot receive more than ordered for this item',
        );
      }
      const line = await tx.scmSupplyReceiptLine.create({
        data: {
          id: (0, crypto_1.randomUUID)(),
          updatedAt: now,
          receiptId: receipt.id,
          supplyItemId: item.id,
          quantity: qty,
          pricePerUnit: new client_1.Prisma.Decimal(
            l.pricePerUnit ?? item.pricePerUnit,
          ),
          currency,
          receivedAt: receiptDate,
          comment: l.comment ?? null,
        },
      });
      await tx.scmSupplyItem.update({
        where: { id: item.id },
        data: {
          quantityReceived: newTotal,
          remainingQuantity: new client_1.Prisma.Decimal(
            item.quantityOrdered,
          ).sub(newTotal),
        },
      });
      const landed = this.computeLandedCostBreakdown(
        item,
        l.pricePerUnit ?? item.pricePerUnit,
      );
      const incomeRes = await this.inventoryOrchestrator.recordIncome(
        {
          itemId: item.itemId,
          warehouseId: supply.warehouseId,
          quantity: qty,
          unitCost: landed.landedUnitCost,
          currency,
          docType: this.MovementDocType?.SUPPLY ?? 'SUPPLY',
          docId: supply.id,
          batchSourceType:
            this.BatchSource?.SUPPLY ??
            inventory_enums_1.InventoryBatchSourceType.SUPPLY,
          movementType:
            this.MovementType?.INCOME ??
            inventory_enums_1.InventoryMovementType.INCOME,
          supplyReceiptId: receipt.id,
          meta: {
            supplyId: supply.id,
            supplyItemId: item.id,
            supplyReceiptId: receipt.id,
            supplyReceiptLineId: line.id,
          },
          occurredAt: receiptDate,
          breakdown: {
            baseUnitCost: landed.baseUnitCost,
            logisticsUnitCost: landed.logisticsUnitCost,
            customsUnitCost: landed.customsUnitCost,
            inboundUnitCost: landed.inboundUnitCost,
          },
          sourceDocType: client_1.AccountingDocType.SUPPLY_RECEIPT,
          sourceDocId: receipt.id,
        },
        tx,
      );
      movementIds.push(String(incomeRes.movementId));
      const lineAmount = qty.mul(landed.landedUnitCost);
      total = total.add(lineAmount);
      lineBreakdown.push({
        supplyItemId: item.id,
        itemId: item.itemId,
        quantity: qty.toString(),
        landedUnitCost: landed.landedUnitCost.toString(),
        amount: lineAmount.toString(),
        movementId: String(incomeRes.movementId),
      });
    }
    if (total.lte(0)) {
      throw new common_1.BadRequestException('Receipt total must be > 0');
    }
    const brandId = supply.brandId ?? null;
    const countryId = supply.warehouse?.countryId ?? null;
    if (!brandId || !countryId) {
      throw new common_1.BadRequestException(
        'Cannot post SUPPLY_RECEIPT: supply.brandId and warehouse.countryId are required',
      );
    }
    const bc = await tx.brandCountry.findUnique({
      where: { brandId_countryId: { brandId, countryId } },
      select: { legalEntityId: true },
    });
    if (!bc?.legalEntityId) {
      throw new common_1.BadRequestException(
        'Cannot post SUPPLY_RECEIPT: BrandCountry.legalEntityId is not configured',
      );
    }
    const run = await this.postingRuns.getOrCreatePostedRun({
      tx,
      legalEntityId: bc.legalEntityId,
      docType: client_1.AccountingDocType.SUPPLY_RECEIPT,
      docId: receipt.id,
    });
    const existingEntries = await tx.accountingEntry.findMany({
      where: { postingRunId: run.id },
      orderBy: [{ lineNumber: 'asc' }],
    });
    const entry =
      existingEntries[0] ??
      (await this.accountingEntries.createEntry({
        tx,
        docType: client_1.AccountingDocType.SUPPLY_RECEIPT,
        docId: receipt.id,
        sourceDocType: client_1.AccountingDocType.SUPPLY,
        sourceDocId: supply.id,
        lineNumber: 1,
        postingDate: receiptDate,
        debitAccount:
          accounting_accounts_config_1.ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS,
        creditAccount:
          accounting_accounts_config_1.ACCOUNTING_ACCOUNTS
            .ACCOUNTS_PAYABLE_SUPPLIERS,
        amount: total,
        currency,
        description: `Supply receipt ${receipt.id} (supply ${supply.id})`,
        metadata: {
          docLineId: `supply_receipt:${receipt.id}:total`,
          supplyId: supply.id,
          supplyReceiptId: receipt.id,
          receiptLineBreakdown: lineBreakdown,
        },
        postingRunId: run.id,
        // explicit scope
        warehouseId: supply.warehouseId,
        countryId: countryId ?? undefined,
        brandId: brandId ?? undefined,
      }));
    await this.inventoryAccountingLink.link({
      tx,
      movementWhere: {
        supplyReceiptId: receipt.id,
      },
      entryWhere: { id: entry.id },
      role: inventory_enums_1.InventoryAccountingLinkRole.SUPPLY_RECEIPT,
    });
    // soft validation (non-blocking): receipt movements must have supplyReceiptId and match supply docType/docId
    try {
      const missing = await tx.stockMovement.count({
        where: {
          supplyReceiptId: receipt.id,
          OR: [
            { docId: { not: supply.id } },
            { docType: { not: this.MovementDocType?.SUPPLY ?? 'SUPPLY' } },
          ],
        },
      });
      if (missing > 0) {
        console.error(
          `[TZ 0.3] Supply receipt movement mismatch: receipt=${receipt.id} supply=${supply.id} badMovements=${missing}`,
        );
      }
      const nulls = await tx.stockMovement.count({
        where: {
          id: { in: movementIds },
          supplyReceiptId: null,
        },
      });
      if (nulls > 0) {
        console.error(
          `[TZ 0.3] Supply receipt movements missing supplyReceiptId: receipt=${receipt.id} missing=${nulls}`,
        );
      }
    } catch (e) {
      console.error(
        '[TZ 0.3] Supply receipt movement validation failed',
        e?.message ?? e,
      );
    }
    return { receipt, entryId: entry.id };
  }

  async voidSupplyReceipt(receiptId, reason) {
    const reasonText = (reason ?? '').trim() || 'void';
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.scmSupplyReceipt.findUnique({
        where: { id: receiptId },
        include: {
          ScmSupply: { include: { warehouse: true } },
        },
      });
      if (!receipt)
        throw new common_1.NotFoundException('SupplyReceipt not found');
      const supply = receipt.ScmSupply;
      const brandId = supply?.brandId ?? null;
      const countryId = supply?.warehouse?.countryId ?? null;
      if (!brandId || !countryId) {
        throw new common_1.BadRequestException(
          'Cannot void SUPPLY_RECEIPT: supply.brandId and warehouse.countryId are required',
        );
      }
      const bc = await tx.brandCountry.findUnique({
        where: { brandId_countryId: { brandId, countryId } },
        select: { legalEntityId: true },
      });
      const legalEntityId = bc?.legalEntityId ?? null;
      if (!legalEntityId) {
        throw new common_1.BadRequestException(
          'Cannot void SUPPLY_RECEIPT: BrandCountry.legalEntityId is not configured',
        );
      }

      // Downstream guard: forbid void if there is an accrued SupplyInvoice linked to this receipt
      const invoice = await tx.financialDocument.findFirst({
        where: {
          linkedDocType: client_1.FinanceLinkedDocType.SUPPLY_RECEIPT,
          linkedDocId: receipt.id,
          type: client_1.FinancialDocumentType.SUPPLY_INVOICE,
        },
        select: { id: true, isAccrued: true },
      });
      if (invoice?.isAccrued) {
        throw new common_1.ConflictException(
          'Cannot void supply receipt: linked SUPPLY_INVOICE is accrued',
        );
      }
      if (invoice?.id) {
        const prs = await tx.paymentRequest.findMany({
          where: { financialDocumentId: invoice.id },
          select: { id: true },
        });
        if (prs.length) {
          const planIds = await tx.paymentPlan.findMany({
            where: { paymentRequestId: { in: prs.map((p) => p.id) } },
            select: { id: true },
          });
          if (planIds.length) {
            const exec = await tx.paymentExecution.findFirst({
              where: { paymentPlanId: { in: planIds.map((p) => p.id) } },
              select: { id: true },
            });
            if (exec) {
              throw new common_1.ConflictException(
                'Cannot void supply receipt: linked SUPPLY_INVOICE already has payment execution',
              );
            }
          }
        }
      }

      // Idempotency: already voided -> return existing reversal run
      const voidedOriginal = await tx.accountingPostingRun.findFirst({
        where: {
          legalEntityId,
          docType: client_1.AccountingDocType.SUPPLY_RECEIPT,
          docId: receipt.id,
          status: 'VOIDED',
          reversalRunId: { not: null },
        },
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });
      if (voidedOriginal?.reversalRunId) {
        await tx.scmSupplyReceipt.update({
          where: { id: receipt.id },
          data: {
            voidedAt: receipt.voidedAt ?? new Date(),
            voidReason: receipt.voidReason ?? reasonText,
          },
        });
        return {
          receiptId: receipt.id,
          alreadyVoided: true,
          originalRunId: voidedOriginal.id,
          reversalRunId: voidedOriginal.reversalRunId,
        };
      }

      const run = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId,
        docType: client_1.AccountingDocType.SUPPLY_RECEIPT,
        docId: receipt.id,
      });
      if (!run) {
        throw new common_1.ConflictException(
          'No active PostingRun found for supply receipt',
        );
      }

      const res = await this.postingRuns.voidRun({
        tx,
        runId: run.id,
        reason: reasonText,
      });
      await tx.scmSupplyReceipt.update({
        where: { id: receipt.id },
        data: { voidedAt: new Date(), voidReason: reasonText },
      });

      return {
        receiptId: receipt.id,
        alreadyVoided: false,
        originalRunId: run.id,
        reversalRunId: res?.reversalRun?.id ?? null,
      };
    });
  }
  computeLandedCostBreakdown(item, overridePricePerUnit) {
    const qtyOrdered = new client_1.Prisma.Decimal(item.quantityOrdered ?? 0);
    if (qtyOrdered.lte(0)) {
      throw new common_1.BadRequestException(
        'Cannot compute landed cost: quantityOrdered must be > 0',
      );
    }
    const pricePerUnit =
      overridePricePerUnit !== undefined
        ? new client_1.Prisma.Decimal(overridePricePerUnit)
        : new client_1.Prisma.Decimal(item.pricePerUnit ?? 0);
    const baseTotal = pricePerUnit.mul(qtyOrdered);
    const logisticsCost = item.logisticsCost
      ? new client_1.Prisma.Decimal(item.logisticsCost)
      : new client_1.Prisma.Decimal(0);
    const customsCost = item.customsCost
      ? new client_1.Prisma.Decimal(item.customsCost)
      : new client_1.Prisma.Decimal(0);
    const inboundCost = item.inboundCost
      ? new client_1.Prisma.Decimal(item.inboundCost)
      : new client_1.Prisma.Decimal(0);
    const baseUnitCost = baseTotal.div(qtyOrdered);
    const logisticsUnitCost = logisticsCost.div(qtyOrdered);
    const customsUnitCost = customsCost.div(qtyOrdered);
    const inboundUnitCost = inboundCost.div(qtyOrdered);
    const landedUnitCost = baseUnitCost
      .add(logisticsUnitCost)
      .add(customsUnitCost)
      .add(inboundUnitCost);
    return {
      baseUnitCost,
      logisticsUnitCost,
      customsUnitCost,
      inboundUnitCost,
      landedUnitCost,
    };
  }
  ensureStatusTransitionAllowed(current, next) {
    if (current === next) return;
    const allowedMap = {
      [client_1.ScmSupplyStatus.DRAFT]: [client_1.ScmSupplyStatus.ORDERED],
      [client_1.ScmSupplyStatus.ORDERED]: [
        client_1.ScmSupplyStatus.PARTIAL_RECEIVED,
        client_1.ScmSupplyStatus.RECEIVED,
        client_1.ScmSupplyStatus.CLOSED,
      ],
      [client_1.ScmSupplyStatus.PARTIAL_RECEIVED]: [
        client_1.ScmSupplyStatus.RECEIVED,
      ],
      [client_1.ScmSupplyStatus.RECEIVED]: [client_1.ScmSupplyStatus.CLOSED],
      [client_1.ScmSupplyStatus.CLOSED]: [],
      [client_1.ScmSupplyStatus.CANCELED]: [],
    };
    const allowedNext = allowedMap[current] ?? [];
    if (!allowedNext.includes(next)) {
      throw new common_1.BadRequestException({
        message: `Invalid supply status transition: ${current} → ${next}`,
        code: 'SCM_SUPPLY_INVALID_STATUS_TRANSITION',
        details: { current, next },
      });
    }
  }
  canTransition(current, next) {
    try {
      this.ensureStatusTransitionAllowed(current, next);
      return true;
    } catch {
      return false;
    }
  }
  async transitionStatus(supplyId, targetStatus, opts) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
      include: {
        items: {
          select: { quantityOrdered: true, quantityReceived: true },
        },
      },
    });
    if (!supply)
      throw new common_1.NotFoundException(
        `Supply with ID ${supplyId} not found`,
      );
    const from = supply.status;
    if (!opts?.force) {
      this.ensureStatusTransitionAllowed(from, targetStatus);
    }
    if (
      targetStatus === (this.SupplyStatus?.CLOSED ?? 'CLOSED') &&
      supply.items.some(
        (it) =>
          (it.quantityReceived?.toNumber?.() ?? it.quantityReceived ?? 0) <
          (it.quantityOrdered?.toNumber?.() ?? it.quantityOrdered ?? 0),
      )
    ) {
      throw new common_1.BadRequestException({
        message: 'Cannot close supply with outstanding quantities',
        code: 'SCM_SUPPLY_CANNOT_CLOSE_WITH_REMAINING',
      });
    }
    const updated = await this.prisma.scmSupply.update({
      where: { id: supplyId },
      data: { status: targetStatus },
    });
    return updated;
  }
  async generateSupplyCode() {
    const year = new Date().getFullYear();
    const prefix = `SUP-${year}-`;
    const latest = await this.prisma.scmSupply.findFirst({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      orderBy: {
        code: 'desc',
      },
    });
    let sequence = 1;
    if (latest) {
      const lastSequence = parseInt(latest.code.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
  async findAll(filters) {
    const where: client_1.Prisma.ScmSupplyWhereInput = {};
    if (filters?.status) {
      const statusArray = filters.status.split(',').map((s) => s.trim());
      if (statusArray.length > 0) {
        where.status = { in: statusArray };
      }
    }
    if (filters?.supplierCounterpartyId) {
      where.supplierCounterpartyId = filters.supplierCounterpartyId;
    }
    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }
    if (filters?.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }
    const requestedLimit = filters?.limit ? Number(filters.limit) : undefined;
    const limit = requestedLimit ? Math.min(requestedLimit, 100) : undefined;
    const supplies = await this.prisma.scmSupply.findMany({
      where,
      include: {
        supplierCounterparty: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    return supplies.map((supply) => ({
      id: supply.id,
      code: supply.code,
      status: supply.status,
      supplierCounterpartyId: supply.supplierCounterpartyId,
      supplier: supply.supplierCounterparty,
      warehouseId: supply.warehouseId,
      warehouse: supply.warehouse,
      productionOrderId: supply.productionOrderId,
      productionOrder: supply.productionOrder,
      currency: supply.currency,
      totalAmount: supply.totalAmount.toNumber(),
      orderDate: supply.orderDate,
      expectedDate: supply.expectedDate,
      receivedDate: supply.receivedDate,
      comment: supply.comment,
      itemsCount: supply._count.items,
      createdAt: supply.createdAt,
      updatedAt: supply.updatedAt,
    }));
  }
  async findOne(id) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        supplierCounterparty: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        items: {
          include: {
            offer: {
              include: {
                item: {
                  select: {
                    id: true,
                    type: true,
                    code: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
            productionOrderItem: {
              include: {
                productionOrder: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                item: {
                  select: {
                    id: true,
                    type: true,
                    code: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    if (!supply) {
      throw new common_1.NotFoundException(`Supply with ID ${id} not found`);
    }
    return {
      id: supply.id,
      code: supply.code,
      status: supply.status,
      supplierCounterpartyId: supply.supplierCounterpartyId,
      supplier: supply.supplierCounterparty,
      warehouseId: supply.warehouseId,
      warehouse: supply.warehouse,
      productionOrderId: supply.productionOrderId,
      productionOrder: supply.productionOrder,
      currency: supply.currency,
      totalAmount: supply.totalAmount.toNumber(),
      orderDate: supply.orderDate,
      expectedDate: supply.expectedDate,
      receivedDate: supply.receivedDate,
      comment: supply.comment,
      items: supply.items.map((item) => ({
        id: item.id,
        offerId: item.offerId ?? null,
        offer: item.offer
          ? {
              id: item.offer.id,
              vendorCode: item.offer.vendorCode,
              currencyCode: item.offer.currencyCode,
              price: item.offer.price?.toNumber?.() ?? item.offer.price,
              isPrimary: item.offer.isPrimary,
              isActive: item.offer.isActive,
              item: item.offer.item,
            }
          : null,
        itemId: item.itemId,
        item: item.item ?? null,
        description: item.description,
        quantityOrdered: item.quantityOrdered.toNumber(),
        quantityReceived: item.quantityReceived.toNumber(),
        totalReceivedQuantity: item.quantityReceived.toNumber(),
        remainingQuantity: item.remainingQuantity.toNumber(),
        unit: item.unit,
        pricePerUnit: item.pricePerUnit.toNumber(),
        currency: item.currency,
        productionOrderItemId: item.productionOrderItemId,
        productionOrderItem: item.productionOrderItem
          ? {
              id: item.productionOrderItem.id,
              productionOrder: item.productionOrderItem.productionOrder,
              item: item.productionOrderItem.item,
            }
          : null,
      })),
      createdAt: supply.createdAt,
      updatedAt: supply.updatedAt,
    };
  }
  async findOneWithFinance(id) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        supplierCounterparty: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        items: {
          include: {
            offer: {
              include: {
                item: {
                  select: {
                    id: true,
                    type: true,
                    code: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
            productionOrderItem: {
              include: {
                productionOrder: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                item: {
                  select: {
                    id: true,
                    type: true,
                    code: true,
                    name: true,
                    unit: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        financialDocuments: {
          select: {
            id: true,
            type: true,
            status: true,
            number: true,
            date: true,
            issueDate: true,
            dueDate: true,
            paidDate: true,
            amountTotal: true,
            amountPaid: true,
            currency: true,
            isAutoCreated: true,
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    if (!supply) {
      throw new common_1.NotFoundException(`Supply with ID ${id} not found`);
    }
    const supplyData = await this.findOne(id);
    return {
      ...supplyData,
      financialDocuments: supply.financialDocuments.map((doc) => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        number: doc.number,
        date: doc.date,
        issueDate: doc.issueDate,
        dueDate: doc.dueDate,
        paidDate: doc.paidDate,
        totalAmount: doc.amountTotal?.toNumber() || 0,
        amountPaid: doc.amountPaid?.toNumber() || 0,
        currency: doc.currency,
        supplier: doc.supplier,
        isAutoCreated: doc.isAutoCreated,
      })),
    };
  }
  async create(dto) {
    const supplier = await this.prisma.counterparty.findUnique({
      where: { id: dto.supplierCounterpartyId },
    });
    if (!supplier) {
      throw new common_1.NotFoundException(
        `Counterparty with ID ${dto.supplierCounterpartyId} not found`,
      );
    }
    if (!(supplier.roles || []).includes(client_1.CounterpartyRole.SUPPLIER)) {
      throw new common_1.UnprocessableEntityException(
        'Counterparty must have role SUPPLIER',
      );
    }
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new common_1.NotFoundException(
        `Warehouse with ID ${dto.warehouseId} not found`,
      );
    }
    if (!warehouse.countryId) {
      throw new scope_validation_1.ScopeValidationException(
        'WAREHOUSE_COUNTRY_REQUIRED',
        'warehouse.countryId is required for ScmSupply',
        { warehouseId: warehouse.id },
      );
    }
    (0, scope_validation_1.assertRequired)(
      warehouse.countryId,
      'warehouse.countryId',
    );
    if (dto.productionOrderId) {
      const productionOrder = await this.prisma.productionOrder.findUnique({
        where: { id: dto.productionOrderId },
      });
      if (!productionOrder) {
        throw new common_1.NotFoundException(
          `Production order with ID ${dto.productionOrderId} not found`,
        );
      }
    }
    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
        select: { id: true },
      });
      if (!brand) {
        throw new common_1.NotFoundException(
          `Brand with ID ${dto.brandId} not found`,
        );
      }
    }
    const code = await this.generateSupplyCode();
    const supply = await this.prisma.scmSupply.create({
      data: {
        code,
        supplierCounterpartyId: dto.supplierCounterpartyId,
        brandId: dto.brandId ?? null,
        warehouseId: dto.warehouseId,
        productionOrderId: dto.productionOrderId,
        status: dto.status ?? client_1.ScmSupplyStatus.DRAFT,
        currency: dto.currency,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : null,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        comment: dto.comment ?? null,
      },
    });
    // Optional: auto-create FinancialDocument for the supply only when we can reliably resolve legalEntityId
    // via BrandCountry (brandId + warehouse.countryId). Otherwise skip silently.
    if (supply.brandId && warehouse.countryId) {
      const brandCountry = await this.prisma.brandCountry.findFirst({
        where: { brandId: supply.brandId, countryId: warehouse.countryId },
        select: { legalEntityId: true },
      });
      if (brandCountry?.legalEntityId) {
        await this.prisma.financialDocument.create({
          data: {
            legalEntityId: brandCountry.legalEntityId,
            type: client_1.FinancialDocumentType.SUPPLY,
            amountTotal: 0,
            currency: dto.currency || 'RUB',
            scmSupplyId: supply.id,
            supplierId: dto.supplierCounterpartyId,
            docDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          },
        });
      }
    }
    return this.findOne(supply.id);
  }
  async update(id, dto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        items: { include: { receipts: true } },
        financialDocuments: true,
      },
    });
    if (!supply) {
      throw new common_1.NotFoundException(`Supply with ID ${id} not found`);
    }
    if (supply.status === client_1.ScmSupplyStatus.RECEIVED) {
      throw new common_1.BadRequestException(
        'Cannot update supply that is already received',
      );
    }
    const updateData: client_1.Prisma.ScmSupplyUpdateInput = {};
    if (dto.warehouseId !== undefined) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });
      if (!warehouse) {
        throw new common_1.NotFoundException(
          `Warehouse with ID ${dto.warehouseId} not found`,
        );
      }
      updateData.warehouse = {
        connect: { id: dto.warehouseId },
      };
    }
    if (dto.productionOrderId !== undefined) {
      if (dto.productionOrderId === null) {
        updateData.productionOrder = { disconnect: true };
      } else {
        const productionOrder = await this.prisma.productionOrder.findUnique({
          where: { id: dto.productionOrderId },
        });
        if (!productionOrder) {
          throw new common_1.NotFoundException(
            `Production order with ID ${dto.productionOrderId} not found`,
          );
        }
        updateData.productionOrder = { connect: { id: dto.productionOrderId } };
      }
    }
    if (dto.supplierCounterpartyId !== undefined) {
      const supplier = await this.prisma.counterparty.findUnique({
        where: { id: dto.supplierCounterpartyId },
      });
      if (!supplier) {
        throw new common_1.NotFoundException(
          `Counterparty with ID ${dto.supplierCounterpartyId} not found`,
        );
      }
      if (
        !(supplier.roles || []).includes(client_1.CounterpartyRole.SUPPLIER)
      ) {
        throw new common_1.UnprocessableEntityException(
          'Counterparty must have role SUPPLIER',
        );
      }
      updateData.supplierCounterparty = {
        connect: { id: dto.supplierCounterpartyId },
      };
    }
    if (dto.currency !== undefined && dto.currency !== supply.currency) {
      const hasItems = (supply.items?.length ?? 0) > 0;
      const hasReceipts = supply.items.some(
        (i) => (i.receipts?.length ?? 0) > 0,
      );
      const hasDocs = (supply.financialDocuments?.length ?? 0) > 0;
      if (hasItems || hasReceipts || hasDocs) {
        throw new common_1.BadRequestException(
          'Cannot change currency for supply that already has items, receipts, or financial documents',
        );
      }
      updateData.currency = dto.currency;
    }
    if (dto.orderDate !== undefined) {
      updateData.orderDate = dto.orderDate ? new Date(dto.orderDate) : null;
    }
    if (dto.expectedDate !== undefined) {
      updateData.expectedDate = dto.expectedDate
        ? new Date(dto.expectedDate)
        : null;
    }
    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
    }
    await this.prisma.scmSupply.update({
      where: { id },
      data: updateData,
    });
    return this.findOne(id);
  }
  async changeStatus(id, dto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
    if (!supply) {
      throw new common_1.NotFoundException(`Supply with ID ${id} not found`);
    }
    const newStatus = dto.status;
    if (!this.canTransition(supply.status, newStatus)) {
      throw new common_1.BadRequestException(
        `Cannot transition supply from ${supply.status} to ${newStatus}`,
      );
    }
    if (
      (newStatus === client_1.ScmSupplyStatus.RECEIVED ||
        newStatus === client_1.ScmSupplyStatus.PARTIAL_RECEIVED) &&
      supply.status !== client_1.ScmSupplyStatus.RECEIVED &&
      supply.status !== client_1.ScmSupplyStatus.PARTIAL_RECEIVED
    ) {
      return this.prisma.$transaction(async (tx) => {
        const supplyWithItems = await tx.scmSupply.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                productionOrderItem: true,
              },
            },
          },
        });
        if (!supplyWithItems) {
          throw new common_1.NotFoundException(
            `Supply with ID ${id} not found`,
          );
        }
        let allReceived = true;
        let anyReceived = false;
        for (const item of supplyWithItems.items) {
          const quantityReceived = item.quantityReceived.toNumber();
          const quantityOrdered = item.quantityOrdered.toNumber();
          if (quantityReceived > 0) {
            anyReceived = true;
            if (item.productionOrderItemId) {
              const productionOrderItem =
                await tx.productionOrderItem.findUnique({
                  where: { id: item.productionOrderItemId },
                });
              if (productionOrderItem) {
                const currentReceived =
                  productionOrderItem.quantityReceived?.toNumber() || 0;
                const newReceived = currentReceived + quantityReceived;
                const planned = productionOrderItem.quantityPlanned.toNumber();
                await tx.productionOrderItem.update({
                  where: { id: item.productionOrderItemId },
                  data: {
                    quantityReceived: newReceived,
                    status:
                      newReceived >= planned
                        ? 'RECEIVED'
                        : newReceived > 0
                          ? 'PARTIALLY_RECEIVED'
                          : productionOrderItem.status,
                  },
                });
              }
            }
          }
          if (quantityReceived < quantityOrdered) {
            allReceived = false;
          }
        }
        const finalStatus = allReceived
          ? client_1.ScmSupplyStatus.RECEIVED
          : anyReceived
            ? client_1.ScmSupplyStatus.PARTIAL_RECEIVED
            : newStatus;
        const updatedSupply = await tx.scmSupply.update({
          where: { id },
          data: {
            status: finalStatus,
            receivedDate:
              finalStatus === client_1.ScmSupplyStatus.RECEIVED
                ? new Date()
                : supplyWithItems.receivedDate,
          },
        });
        if (
          finalStatus === client_1.ScmSupplyStatus.RECEIVED ||
          finalStatus === client_1.ScmSupplyStatus.PARTIAL_RECEIVED
        ) {
          for (const item of supplyWithItems.items) {
            const received =
              item.quantityReceived?.toNumber?.() ?? item.quantityReceived ?? 0;
            if (received <= 0) continue;
            const itemCurrency =
              item.currency || supplyWithItems.currency || 'RUB';
            const landed = this.computeLandedCostBreakdown(item, undefined);
            const mdmItemId = item.itemId;
            await this.inventoryOrchestrator.recordIncome(
              {
                itemId: mdmItemId,
                warehouseId: supplyWithItems.warehouseId,
                quantity: received,
                unitCost: landed.landedUnitCost,
                currency: itemCurrency,
                docType: inventory_enums_1.InventoryDocumentType.SUPPLY,
                docId: supplyWithItems.id,
                batchSourceType:
                  inventory_enums_1.InventoryBatchSourceType.SUPPLY,
                movementType: inventory_enums_1.InventoryMovementType.INCOME,
                occurredAt: supplyWithItems.receivedDate ?? new Date(),
                breakdown: {
                  baseUnitCost: landed.baseUnitCost,
                  logisticsUnitCost: landed.logisticsUnitCost,
                  customsUnitCost: landed.customsUnitCost,
                  inboundUnitCost: landed.inboundUnitCost,
                },
                meta: { supplyId: supplyWithItems.id, supplyItemId: item.id },
                sourceDocType: client_1.AccountingDocType.SUPPLY,
                sourceDocId: supplyWithItems.id,
              },
              tx,
            );
          }
        }
        const result = await this.findOne(updatedSupply.id);
        if (result.productionOrderId) {
          const poId = result.productionOrderId;
          setImmediate(() => {
            this.provisioningRecalc.recalcForProductionOrder?.(poId);
          });
        }
        return result;
      });
    }
    const updatedSupply = await this.prisma.scmSupply.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });
    return this.findOne(updatedSupply.id);
  }
  async findItems(supplyId) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
    });
    if (!supply) {
      throw new common_1.NotFoundException(
        `Supply with ID ${supplyId} not found`,
      );
    }
    const items = await this.prisma.scmSupplyItem.findMany({
      where: { supplyId },
      include: {
        offer: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
        item: {
          select: { id: true, type: true, code: true, name: true, unit: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((item) => ({
      id: item.id,
      offerId: item.offerId ?? null,
      offer: item.offer
        ? {
            id: item.offer.id,
            vendorCode: item.offer.vendorCode,
            currencyCode: item.offer.currencyCode,
            price: item.offer.price?.toNumber?.() ?? item.offer.price,
            isPrimary: item.offer.isPrimary,
            isActive: item.offer.isActive,
            item: item.offer.item,
          }
        : null,
      itemId: item.itemId,
      item: item.item ?? null,
      description: item.description,
      quantityOrdered: item.quantityOrdered.toNumber(),
      quantityReceived: item.quantityReceived.toNumber(),
      totalReceivedQuantity: item.quantityReceived.toNumber(),
      remainingQuantity: item.remainingQuantity.toNumber(),
      unit: item.unit,
      pricePerUnit: item.pricePerUnit.toNumber(),
      currency: item.currency,
      logisticsCost:
        item.logisticsCost?.toNumber?.() ?? item.logisticsCost ?? null,
      customsCost: item.customsCost?.toNumber?.() ?? item.customsCost ?? null,
      inboundCost: item.inboundCost?.toNumber?.() ?? item.inboundCost ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
  async ensureSupplyExists(id) {
    const supply = await this.prisma.scmSupply.findUnique({ where: { id } });
    if (!supply) {
      throw new common_1.NotFoundException(`Supply with ID ${id} not found`);
    }
  }
  async createItem(supplyId, dto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
    });
    if (!supply) {
      throw new common_1.NotFoundException(
        `Supply with ID ${supplyId} not found`,
      );
    }
    const providedIds = [
      dto.offerId ? 'offerId' : null,
      dto.itemId ? 'itemId' : null,
    ].filter(Boolean);
    if (providedIds.length !== 1) {
      throw new common_1.BadRequestException(
        'Exactly one of offerId or itemId must be provided',
      );
    }
    let offerId = null;
    let resolvedItemId = null;
    if (dto.offerId) {
      const offer = await this.prisma.counterpartyOffer.findUnique({
        where: { id: dto.offerId },
        select: {
          id: true,
          counterpartyId: true,
          itemId: true,
          isActive: true,
        },
      });
      if (!offer)
        throw new common_1.NotFoundException(`Offer ${dto.offerId} not found`);
      if (offer.counterpartyId !== supply.supplierCounterpartyId) {
        throw new common_1.BadRequestException(
          'Offer counterparty does not match supply supplierCounterpartyId',
        );
      }
      if (!offer.isActive) {
        throw new common_1.BadRequestException('Offer is inactive');
      }
      offerId = offer.id;
      resolvedItemId = offer.itemId;
    }
    if (dto.currency && dto.currency !== supply.currency) {
      throw new common_1.BadRequestException(
        'Supply item currency must match supply currency',
      );
    }
    if (dto.itemId) {
      const mdmItem = await this.prisma.mdmItem.findUnique({
        where: { id: dto.itemId },
        select: { id: true, type: true },
      });
      if (!mdmItem)
        throw new common_1.NotFoundException(`MdmItem ${dto.itemId} not found`);
      if (mdmItem.type === 'MATERIAL') {
        throw new common_1.BadRequestException(
          'For MATERIAL supply lines you must provide offerId (VendorSKU).',
        );
      }
      resolvedItemId = mdmItem.id;
    }
    const mdmItem = await this.prisma.mdmItem.findUnique({
      where: { id: resolvedItemId ?? '' },
      select: { id: true, type: true },
    });
    if (mdmItem?.type === 'MATERIAL' && !offerId) {
      throw new common_1.BadRequestException(
        'offerId is required for material supply lines',
      );
    }
    if (!resolvedItemId) {
      throw new common_1.BadRequestException(
        'Failed to resolve itemId for supply line',
      );
    }
    const item = await this.prisma.scmSupplyItem.create({
      data: {
        supplyId,
        offerId,
        itemId: resolvedItemId,
        description: dto.description ?? null,
        unit: dto.unit,
        quantityOrdered: dto.quantityOrdered,
        quantityReceived: dto.quantityReceived ?? 0,
        remainingQuantity: new client_1.Prisma.Decimal(dto.quantityOrdered).sub(
          new client_1.Prisma.Decimal(dto.quantityReceived ?? 0),
        ),
        pricePerUnit: dto.pricePerUnit,
        currency: supply.currency,
        logisticsCost: dto.logisticsCost ?? null,
        customsCost: dto.customsCost ?? null,
        inboundCost: dto.inboundCost ?? null,
      },
      include: {
        item: {
          select: { id: true, type: true, code: true, name: true, unit: true },
        },
        offer: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });
    return {
      id: item.id,
      offerId: item.offerId ?? null,
      offer: item.offer
        ? {
            id: item.offer.id,
            vendorCode: item.offer.vendorCode,
            currencyCode: item.offer.currencyCode,
            price: item.offer.price?.toNumber?.() ?? item.offer.price,
            isPrimary: item.offer.isPrimary,
            isActive: item.offer.isActive,
            item: item.offer.item,
          }
        : null,
      itemId: item.itemId,
      item: item.item ?? null,
      description: item.description,
      quantityOrdered: item.quantityOrdered.toNumber(),
      quantityReceived: item.quantityReceived.toNumber(),
      totalReceivedQuantity: item.quantityReceived.toNumber(),
      remainingQuantity: item.remainingQuantity.toNumber(),
      unit: item.unit,
      pricePerUnit: item.pricePerUnit.toNumber(),
      currency: item.currency,
      logisticsCost:
        item.logisticsCost?.toNumber?.() ?? item.logisticsCost ?? null,
      customsCost: item.customsCost?.toNumber?.() ?? item.customsCost ?? null,
      inboundCost: item.inboundCost?.toNumber?.() ?? item.inboundCost ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  async updateItem(supplyId, itemId, dto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
      select: { id: true, currency: true },
    });
    if (!supply) {
      throw new common_1.NotFoundException(
        `Supply with ID ${supplyId} not found`,
      );
    }
    const existingItem = await this.prisma.scmSupplyItem.findFirst({
      where: {
        id: itemId,
        supplyId: supplyId,
      },
    });
    if (!existingItem) {
      throw new common_1.NotFoundException(
        `Supply item with ID ${itemId} not found for supply ${supplyId}`,
      );
    }
    const updateData: client_1.Prisma.ScmSupplyItemUpdateInput = {};
    if (dto.quantityOrdered !== undefined) {
      updateData.quantityOrdered = dto.quantityOrdered;
    }
    if (dto.quantityReceived !== undefined) {
      updateData.quantityReceived = dto.quantityReceived;
    }
    if (
      dto.quantityOrdered !== undefined ||
      dto.quantityReceived !== undefined
    ) {
      const ordered =
        dto.quantityOrdered !== undefined
          ? new client_1.Prisma.Decimal(dto.quantityOrdered)
          : existingItem.quantityOrdered;
      const received =
        dto.quantityReceived !== undefined
          ? new client_1.Prisma.Decimal(dto.quantityReceived)
          : existingItem.quantityReceived;
      updateData.remainingQuantity = ordered.sub(received);
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.pricePerUnit !== undefined) {
      updateData.pricePerUnit = dto.pricePerUnit;
    }
    if (dto.currency !== undefined && dto.currency !== supply.currency) {
      throw new common_1.BadRequestException(
        'Supply item currency must match supply currency',
      );
    }
    updateData.currency = supply.currency;
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.logisticsCost !== undefined) {
      updateData.logisticsCost = dto.logisticsCost;
    }
    if (dto.customsCost !== undefined) {
      updateData.customsCost = dto.customsCost;
    }
    if (dto.inboundCost !== undefined) {
      updateData.inboundCost = dto.inboundCost;
    }
    const item = await this.prisma.scmSupplyItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        item: {
          select: { id: true, type: true, code: true, name: true, unit: true },
        },
        offer: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });
    return {
      id: item.id,
      offerId: item.offerId ?? null,
      offer: item.offer ?? null,
      itemId: item.itemId,
      item: item.item ?? null,
      description: item.description,
      quantityOrdered: item.quantityOrdered.toNumber(),
      quantityReceived: item.quantityReceived.toNumber(),
      totalReceivedQuantity: item.quantityReceived.toNumber(),
      remainingQuantity: item.remainingQuantity.toNumber(),
      unit: item.unit,
      pricePerUnit: item.pricePerUnit.toNumber(),
      currency: item.currency,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
  async deleteItem(supplyId, itemId) {
    await this.ensureSupplyExists(supplyId);
    const existingItem = await this.prisma.scmSupplyItem.findFirst({
      where: {
        id: itemId,
        supplyId: supplyId,
      },
    });
    if (!existingItem) {
      throw new common_1.NotFoundException(
        `Supply item with ID ${itemId} not found for supply ${supplyId}`,
      );
    }
    await this.prisma.scmSupplyItem.delete({
      where: { id: itemId },
    });
    return { success: true };
  }
  async remove(id) {
    await this.ensureSupplyExists(id);
    await this.prisma.scmSupplyItem.deleteMany({ where: { supplyId: id } });
    return this.prisma.scmSupply.delete({ where: { id } });
  }
  async confirmReceiveOs(payload) {
    return this.confirmReceive(payload.supplyId, payload);
  }
  async confirmReceive(supplyId, dto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
      include: {
        items: true,
        warehouse: true,
      },
    });
    if (!supply) {
      throw new common_1.NotFoundException(
        `Supply with ID ${supplyId} not found`,
      );
    }
    if (!supply.warehouseId) {
      throw new common_1.BadRequestException(
        'Supply must have a warehouseId to confirm receive',
      );
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const lines: Array<{
        item: any;
        quantity: any;
        pricePerUnit: any;
        currency: any;
        comment?: any;
      }> = [];
      for (const it of supply.items) {
        const received =
          it.quantityReceived?.toNumber?.() ?? it.quantityReceived ?? 0;
        const ordered =
          it.quantityOrdered?.toNumber?.() ?? it.quantityOrdered ?? 0;
        const remaining = new client_1.Prisma.Decimal(ordered).sub(
          new client_1.Prisma.Decimal(received),
        );
        if (remaining.lte(0)) continue;
        lines.push({
          item: it,
          quantity: remaining,
          pricePerUnit: it.pricePerUnit,
          currency: it.currency,
        });
      }
      if (lines.length === 0) {
        throw new common_1.BadRequestException(
          'Supply has no remaining quantities to receive',
        );
      }
      await this.receiveSupplyInternal(tx, {
        supply,
        lines,
        receivedAt: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
        comment: dto.comment ?? null,
      });
      const refreshedItems = await tx.scmSupplyItem.findMany({
        where: { supplyId },
      });
      const allReceived = refreshedItems.every((it) => {
        const r = it.quantityReceived?.toNumber?.() ?? it.quantityReceived ?? 0;
        const o = it.quantityOrdered?.toNumber?.() ?? it.quantityOrdered ?? 0;
        return r >= o;
      });
      const updatedSupply = await tx.scmSupply.update({
        where: { id: supply.id },
        data: {
          status: allReceived
            ? client_1.ScmSupplyStatus.RECEIVED
            : client_1.ScmSupplyStatus.PARTIAL_RECEIVED,
          receivedDate: allReceived
            ? dto.receivedDate
              ? new Date(dto.receivedDate)
              : new Date()
            : supply.receivedDate,
          comment: dto.comment ?? supply.comment,
        },
      });
      return updatedSupply;
    });
    // NOTE (TZ 8.3.B.3): SCM receipt/receive must not depend on auto-invoice creation.
    return this.findOne(result.id);
  }
  async partialReceive(supplyId, dto) {
    if (!dto.items || dto.items.length === 0) {
      throw new common_1.BadRequestException('items array is required');
    }
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
      include: {
        items: true,
        warehouse: true,
      },
    });
    if (!supply) {
      throw new common_1.NotFoundException(
        `Supply with ID ${supplyId} not found`,
      );
    }
    if (!supply.warehouseId) {
      throw new common_1.BadRequestException(
        'Supply must have warehouse to receive',
      );
    }
    const blockedStatuses = [
      this.SupplyStatus?.CANCELED ?? 'CANCELED',
      this.SupplyStatus?.CLOSED ?? 'CLOSED',
    ];
    if (blockedStatuses.includes(supply.status)) {
      throw new common_1.BadRequestException(
        `Supply status ${supply.status} does not allow receiving`,
      );
    }
    const itemsMap = new Map<string, any>(supply.items.map((i) => [i.id, i]));
    const txResult = await this.prisma.$transaction(async (tx) => {
      const lines: Array<{
        item: any;
        quantity: any;
        pricePerUnit: any;
        currency: any;
        comment?: any;
      }> = [];
      for (const rec of dto.items) {
        this.validatePartialItem(rec);
        const item = itemsMap.get(rec.supplyItemId);
        if (!item) {
          throw new common_1.NotFoundException(
            `Supply item ${rec.supplyItemId} not found for supply ${supplyId}`,
          );
        }
        lines.push({
          item,
          quantity: rec.quantity,
          pricePerUnit: rec.pricePerUnit,
          currency: rec.currency || item.currency || supply.currency || 'RUB',
          comment: rec.comment,
        });
      }
      const receiptDate = dto.items[0]?.receivedAt
        ? new Date(dto.items[0].receivedAt)
        : new Date();
      const { receipt } = await this.receiveSupplyInternal(tx, {
        supply,
        lines,
        receivedAt: receiptDate,
        comment: dto.items[0]?.comment ?? null,
      });
      const refreshedItems = await tx.scmSupplyItem.findMany({
        where: { supplyId },
      });
      const allReceived = refreshedItems.every((it) => {
        const r = it.quantityReceived?.toNumber?.() ?? it.quantityReceived ?? 0;
        const o = it.quantityOrdered?.toNumber?.() ?? it.quantityOrdered ?? 0;
        return r >= o;
      });
      await tx.scmSupply.update({
        where: { id: supplyId },
        data: {
          status: allReceived
            ? (this.SupplyStatus?.RECEIVED ?? 'RECEIVED')
            : (this.SupplyStatus?.PARTIAL_RECEIVED ?? 'PARTIAL_RECEIVED'),
          receivedDate: allReceived ? new Date() : supply.receivedDate,
        },
      });
      return { receiptId: receipt.id };
    });
    // NOTE (TZ 8.3.B.3): SCM receipt/receive must not depend on auto-invoice creation.
    const supplyResult = await this.findOne(supplyId);
    return {
      supplyId,
      status: supplyResult.status,
      items: supplyResult.items
        .filter((i) => dto.items.some((r) => r.supplyItemId === i.id))
        .map((i) => ({
          supplyItemId: i.id,
          receivedQuantity: i.quantityReceived,
          totalReceivedQuantity: i.quantityReceived,
          remainingQuantity: i.remainingQuantity ?? 0,
        })),
      receipts: [{ id: txResult.receiptId }],
    };
  }
  validatePartialItem(item) {
    if (item.quantity <= 0) {
      throw new common_1.BadRequestException('Quantity must be positive');
    }
    if (item.pricePerUnit <= 0) {
      throw new common_1.BadRequestException('pricePerUnit must be positive');
    }
  }
}
