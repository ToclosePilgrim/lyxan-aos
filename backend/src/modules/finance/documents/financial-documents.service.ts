import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateFinancialDocumentDto } from './dto/create-financial-document.dto';
import { UpdateFinancialDocumentDto } from './dto/update-financial-document.dto';
import { FinancialDocumentFiltersDto } from './dto/financial-document-filters.dto';
import { AttachServiceDto } from './dto/attach-service.dto';
import {
  Prisma,
  FinancialDocumentType,
  FinancialDocumentStatus,
  FinanceLinkedDocType,
  AccountingDocType,
  FinanceCapitalizationPolicy,
} from '@prisma/client';
import { CreateFinancePaymentDto } from './dto/create-finance-payment.dto';
import { financeConfig } from '../../../config/finance.config';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';
import { FinanceCategoryResolverService } from '../category-default-mappings/category-resolver.service';
import { FinanceCategoryMappingSourceType } from '@prisma/client';
import { getNextLineNumber } from '../accounting-entry/accounting-entry.utils';
import { RecurringJournalsService } from '../recurring-journals/recurring-journals.service';
import { RecurringJournalType } from '@prisma/client';
import { PostingRunsService } from '../posting-runs/posting-runs.service';

@Injectable()
export class FinancialDocumentsService {
  constructor(
    private prisma: PrismaService,
    private currencyRates: CurrencyRateService,
    private accountingEntries: AccountingEntryService,
    private categoryResolver: FinanceCategoryResolverService,
    private recurring: RecurringJournalsService,
    private postingRuns: PostingRunsService,
  ) {}

  private isPnlImpactingType(
    type: FinancialDocumentType | null | undefined,
  ): boolean {
    if (!type) return false;
    const nonPnl = new Set<FinancialDocumentType>([
      FinancialDocumentType.SUPPLY,
      FinancialDocumentType.SUPPLY_INVOICE,
      FinancialDocumentType.LOAN_PRINCIPAL,
    ] as any);
    return !nonPnl.has(type);
  }

  private async resolveAndEnforceCategories(params: {
    legalEntityId: string;
    type?: FinancialDocumentType | null;
    cashflowCategoryId?: string | null;
    pnlCategoryId?: string | null;
  }): Promise<{
    cashflowCategoryId: string;
    pnlCategoryId: string | null;
    classificationMeta: {
      sourceType: FinanceCategoryMappingSourceType;
      sourceCode: string;
      resolvedBy: string;
      mappingId: string | null;
    };
  }> {
    const sourceType = FinanceCategoryMappingSourceType.FINANCIAL_DOCUMENT_TYPE;
    const sourceCode = (params.type ?? '').toString().trim().toUpperCase();

    let cashflowCategoryId = params.cashflowCategoryId ?? null;
    let pnlCategoryId = params.pnlCategoryId ?? null;
    let resolvedBy = 'EXPLICIT';
    let mappingId: string | null = null;

    if (
      !cashflowCategoryId ||
      (this.isPnlImpactingType(params.type) && !pnlCategoryId)
    ) {
      const resolved = await this.categoryResolver.resolveDefaults({
        legalEntityId: params.legalEntityId,
        sourceType,
        sourceCode,
      });
      mappingId = resolved.mappingId;
      resolvedBy = resolved.resolvedBy;
      cashflowCategoryId = cashflowCategoryId ?? resolved.cashflowCategoryId;
      if (this.isPnlImpactingType(params.type)) {
        pnlCategoryId = pnlCategoryId ?? resolved.pnlCategoryId;
      }
    }

    if (!cashflowCategoryId) {
      throw new UnprocessableEntityException(
        `cashflowCategoryId is required (no default mapping for FINANCIAL_DOCUMENT_TYPE:${sourceCode || 'UNKNOWN'})`,
      );
    }
    if (this.isPnlImpactingType(params.type) && !pnlCategoryId) {
      throw new UnprocessableEntityException(
        `pnlCategoryId is required for type ${sourceCode} (no default mapping)`,
      );
    }

    // Validate category existence
    const cf = await this.prisma.cashflowCategory.findUnique({
      where: { id: cashflowCategoryId },
      select: { id: true },
    });
    if (!cf) throw new NotFoundException('CashflowCategory not found');
    if (pnlCategoryId) {
      const pnl = await this.prisma.pnlCategory.findUnique({
        where: { id: pnlCategoryId },
        select: { id: true },
      });
      if (!pnl) throw new NotFoundException('PnlCategory not found');
    }

    return {
      cashflowCategoryId,
      pnlCategoryId,
      classificationMeta: {
        sourceType,
        sourceCode,
        resolvedBy,
        mappingId,
      },
    };
  }

  async create(dto: CreateFinancialDocumentDto) {
    const legalEntityId = await this.resolveLegalEntityIdForDocument(dto);
    if (!legalEntityId) {
      throw new BadRequestException(
        'Cannot resolve legalEntityId; provide explicitly or link to scoped doc',
      );
    }

    const docDate = dto.docDate
      ? new Date(dto.docDate)
      : dto.date
        ? new Date(dto.date)
        : new Date();
    const currency = dto.currency
      ? String(dto.currency).toUpperCase().trim()
      : null;
    const amountTotal =
      dto.amountTotal !== undefined
        ? new Prisma.Decimal(dto.amountTotal)
        : null;
    const amountPaid =
      dto.amountPaid !== undefined ? new Prisma.Decimal(dto.amountPaid) : null;
    const { amountTotalBase, amountPaidBase } = await this.computeBaseAmounts({
      currency,
      amountTotal,
      amountPaid,
      date: docDate,
    });

    const { cashflowCategoryId, pnlCategoryId, classificationMeta } =
      await this.resolveAndEnforceCategories({
        legalEntityId,
        type: dto.type ?? null,
        cashflowCategoryId: dto.cashflowCategoryId ?? null,
        pnlCategoryId: dto.pnlCategoryId ?? null,
      });

    const created = await this.prisma.financialDocument.create({
      data: {
        legalEntityId,
        docNumber: dto.docNumber ?? null,
        docDate: dto.docDate ? new Date(dto.docDate) : null,
        type: dto.type ?? null,
        direction: dto.direction ?? null,
        status: dto.status ?? FinancialDocumentStatus.DRAFT,
        currency,
        amountTotal,
        amountPaid,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        supplierId: dto.supplierId ?? null,
        productionOrderId: dto.productionOrderId ?? null,
        scmSupplyId: dto.scmSupplyId ?? null,
        linkedDocType: dto.linkedDocType ?? null,
        linkedDocId: dto.linkedDocId ?? null,
        externalId: (dto as any).externalId ?? null,
        fileUrl: (dto as any).fileUrl ?? null,
        notes: (dto as any).notes ?? null,
        cashflowCategoryId,
        pnlCategoryId,
        capitalizationPolicy:
          dto.capitalizationPolicy ??
          FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
        recognizedFrom: dto.recognizedFrom
          ? new Date(dto.recognizedFrom)
          : null,
        recognizedTo: dto.recognizedTo ? new Date(dto.recognizedTo) : null,
        usefulLifeMonths: (dto as any).usefulLifeMonths ?? null,
        amountTotalBase,
        amountPaidBase,
        // small transparency: store mapping provenance in notes if not explicit and notes empty
        comment:
          (dto as any).comment ??
          (classificationMeta.resolvedBy !== 'EXPLICIT'
            ? `[AUTO_CATEGORY:${classificationMeta.resolvedBy}] ${classificationMeta.sourceType}:${classificationMeta.sourceCode}`
            : null),
      } as any,
    });

    return { ...created, classificationMeta };
  }

  async addPayment(documentId: string, dto: CreateFinancePaymentDto) {
    const doc = await this.prisma.financialDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('FinancialDocument not found');

    const paidAtRaw = dto.date ?? dto.paidAt ?? null;
    const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
    const amount = new Prisma.Decimal(dto.amount);

    const payment = await this.prisma.financePayment.create({
      data: {
        documentId,
        amount,
        currency: String(dto.currency).toUpperCase(),
        date: paidAt,
        method: dto.method ?? null,
        externalRef: dto.externalRef ?? null,
        comment: dto.comment ?? null,
      },
    });

    // Update aggregates (MVP): recompute total paid from payments table
    const agg = await this.prisma.financePayment.aggregate({
      where: { documentId },
      _sum: { amount: true },
    });
    const amountPaid = agg._sum.amount ?? new Prisma.Decimal(0);

    const updated = await this.prisma.financialDocument.update({
      where: { id: documentId },
      data: {
        amountPaid,
        paidDate: amountPaid.gt(0) ? paidAt : null,
      },
    });

    return { payment, document: updated };
  }

  async getPayments(documentId: string) {
    const doc = await this.prisma.financialDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('FinancialDocument not found');

    const payments = await this.prisma.financePayment.findMany({
      where: { documentId },
      orderBy: { date: 'asc' },
    });
    const totalPaid = payments.reduce(
      (acc, p) => acc.add(p.amount),
      new Prisma.Decimal(0),
    );

    return { documentId, payments, totalPaid };
  }

  /**
   * Controller route exists; implement minimal safe behavior.
   */
  async createFromSupply(supplyId: string, dto: CreateFinancialDocumentDto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
      select: { id: true, supplierCounterpartyId: true },
    });
    if (!supply) throw new NotFoundException('Supply not found');
    return this.create({
      ...dto,
      scmSupplyId: supply.id,
      supplierId:
        (dto as any).supplierId ??
        (supply as any).supplierCounterpartyId ??
        null,
      linkedDocType: FinanceLinkedDocType.SUPPLY,
      linkedDocId: supply.id,
    } as any);
  }

  /**
   * Controller route exists; implement minimal safe behavior.
   */
  async createFromProductionOrder(
    orderId: string,
    dto: CreateFinancialDocumentDto,
  ) {
    const po = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!po) throw new NotFoundException('Production order not found');
    return this.create({
      ...dto,
      productionOrderId: po.id,
      linkedDocType: FinanceLinkedDocType.PRODUCTION_ORDER,
      linkedDocId: po.id,
    } as any);
  }

  async createFromSupplyReceipt(dto: {
    supplyReceiptId: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    amount?: number;
    currency?: string;
  }) {
    // Idempotency by link
    const existing = await this.prisma.financialDocument.findFirst({
      where: {
        linkedDocType: FinanceLinkedDocType.SUPPLY_RECEIPT,
        linkedDocId: dto.supplyReceiptId,
      } as any,
    });
    if (existing) return existing;

    const receipt = await this.prisma.scmSupplyReceipt.findUnique({
      where: { id: dto.supplyReceiptId },
      include: {
        ScmSupply: {
          select: {
            id: true,
            brandId: true,
            supplierCounterpartyId: true,
            warehouse: { select: { countryId: true } },
          } as any,
        },
      } as any,
    });
    if (!receipt) throw new NotFoundException('SupplyReceipt not found');

    const supplyId = (receipt as any).ScmSupply?.id ?? null;
    const brandId = (receipt as any).ScmSupply?.brandId ?? null;
    const countryId = (receipt as any).ScmSupply?.warehouse?.countryId ?? null;
    const supplierId =
      (receipt as any).ScmSupply?.supplierCounterpartyId ?? null;
    if (!brandId || !countryId) {
      throw new UnprocessableEntityException(
        'Cannot resolve legalEntityId for supply receipt (missing brandId or warehouse.countryId)',
      );
    }

    const bc = await (this.prisma as any).brandCountry.findUnique({
      where: { brandId_countryId: { brandId, countryId } } as any,
      select: { legalEntityId: true },
    });
    const legalEntityId = bc?.legalEntityId ?? null;
    if (!legalEntityId) {
      throw new UnprocessableEntityException(
        'No BrandCountry.legalEntityId configured for brand+country (required for finance)',
      );
    }

    const receiptEntry = await this.prisma.accountingEntry.findFirst({
      where: {
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: receipt.id,
      } as any,
      orderBy: { createdAt: 'desc' },
    });

    const currency = (
      dto.currency ??
      receiptEntry?.currency ??
      receipt.currency ??
      'RUB'
    )
      .toString()
      .toUpperCase()
      .trim();

    const amountTotal =
      dto.amount !== undefined
        ? new Prisma.Decimal(dto.amount)
        : receiptEntry?.amount
          ? new Prisma.Decimal(receiptEntry.amount as any)
          : null;
    if (!amountTotal) {
      throw new UnprocessableEntityException(
        'Cannot resolve invoice amount (receipt total missing)',
      );
    }

    const docDate = dto.invoiceDate
      ? new Date(dto.invoiceDate)
      : (receipt.receivedAt ?? new Date());
    const { amountTotalBase } = await this.computeBaseAmounts({
      currency,
      amountTotal,
      amountPaid: null,
      date: docDate,
    });

    const { cashflowCategoryId, pnlCategoryId, classificationMeta } =
      await this.resolveAndEnforceCategories({
        legalEntityId,
        type: FinancialDocumentType.SUPPLY_INVOICE,
        cashflowCategoryId: null,
        pnlCategoryId: null,
      });

    const created = await this.prisma.financialDocument.create({
      data: {
        legalEntityId,
        type: FinancialDocumentType.SUPPLY_INVOICE,
        status: FinancialDocumentStatus.DRAFT,
        direction: null as any,
        docNumber: dto.invoiceNumber ?? null,
        docDate,
        currency,
        amountTotal,
        amountTotalBase,
        amountPaid: new Prisma.Decimal(0),
        amountPaidBase: new Prisma.Decimal(0),
        supplierId: supplierId ?? null,
        scmSupplyId: supplyId ?? null,
        linkedDocType: FinanceLinkedDocType.SUPPLY_RECEIPT,
        linkedDocId: receipt.id,
        cashflowCategoryId,
        pnlCategoryId,
        capitalizationPolicy: FinanceCapitalizationPolicy.INVENTORY,
        comment:
          classificationMeta.resolvedBy !== 'EXPLICIT'
            ? `[AUTO_CATEGORY:${classificationMeta.resolvedBy}] FINANCIAL_DOCUMENT_TYPE:SUPPLY_INVOICE`
            : null,
      } as any,
    });

    return { ...created, classificationMeta };
  }

  async update(id: string, dto: UpdateFinancialDocumentDto) {
    const existing = await this.prisma.financialDocument.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Financial document not found');

    const nextType =
      (dto as any).type !== undefined
        ? ((dto as any).type as FinancialDocumentType)
        : ((existing as any).type ?? null);
    const nextLegalEntityId =
      (dto as any).legalEntityId !== undefined
        ? ((dto as any).legalEntityId as string)
        : existing.legalEntityId;

    const { cashflowCategoryId, pnlCategoryId, classificationMeta } =
      await this.resolveAndEnforceCategories({
        legalEntityId: nextLegalEntityId,
        type: nextType,
        cashflowCategoryId:
          (dto as any).cashflowCategoryId !== undefined
            ? (dto as any).cashflowCategoryId
            : (existing as any).cashflowCategoryId,
        pnlCategoryId:
          (dto as any).pnlCategoryId !== undefined
            ? (dto as any).pnlCategoryId
            : (existing as any).pnlCategoryId,
      });

    const updated = await this.prisma.financialDocument.update({
      where: { id },
      data: {
        docNumber: (dto as any).docNumber ?? undefined,
        docDate: (dto as any).docDate
          ? new Date((dto as any).docDate)
          : undefined,
        type: (dto as any).type ?? undefined,
        direction: (dto as any).direction ?? undefined,
        status: (dto as any).status ?? undefined,
        currency: (dto as any).currency
          ? String((dto as any).currency)
              .toUpperCase()
              .trim()
          : undefined,
        amountTotal:
          (dto as any).amountTotal !== undefined
            ? new Prisma.Decimal((dto as any).amountTotal)
            : undefined,
        amountPaid:
          (dto as any).amountPaid !== undefined
            ? new Prisma.Decimal((dto as any).amountPaid)
            : undefined,
        dueDate: (dto as any).dueDate
          ? new Date((dto as any).dueDate)
          : undefined,
        supplierId: (dto as any).supplierId ?? undefined,
        productionOrderId: (dto as any).productionOrderId ?? undefined,
        scmSupplyId: (dto as any).scmSupplyId ?? undefined,
        linkedDocType: (dto as any).linkedDocType ?? undefined,
        linkedDocId: (dto as any).linkedDocId ?? undefined,
        cashflowCategoryId,
        pnlCategoryId,
        usefulLifeMonths:
          (dto as any).usefulLifeMonths !== undefined
            ? (dto as any).usefulLifeMonths
            : undefined,
      } as any,
    });

    return { ...updated, classificationMeta };
  }

  private async computeBaseAmounts(params: {
    currency?: string | null;
    amountTotal?: number | Prisma.Decimal | null;
    amountPaid?: number | Prisma.Decimal | null;
    date: Date;
  }): Promise<{
    amountTotalBase: Prisma.Decimal | null;
    amountPaidBase: Prisma.Decimal | null;
  }> {
    const currency = params.currency;
    if (!currency) {
      return { amountTotalBase: null, amountPaidBase: null };
    }
    const total = params.amountTotal ?? 0;
    const paid = params.amountPaid ?? 0;
    const amountTotalBase = await this.currencyRates.convertToBase({
      amount: total,
      currency,
      date: params.date,
    });
    const amountPaidBase = await this.currencyRates.convertToBase({
      amount: paid,
      currency,
      date: params.date,
    });
    return { amountTotalBase, amountPaidBase };
  }

  private async resolveLegalEntityIdForDocument(
    dto: CreateFinancialDocumentDto,
  ) {
    if ((dto as any).legalEntityId) {
      return (dto as any).legalEntityId as string;
    }

    const resolveFromBrandCountry = async (
      brandId?: string | null,
      countryId?: string | null,
    ) => {
      if (!brandId || !countryId) return null;
      const bc = await (this.prisma as any).brandCountry.findUnique({
        where: { brandId_countryId: { brandId, countryId } },
        select: { legalEntityId: true },
      });
      return bc?.legalEntityId ?? null;
    };

    // Try linked docs first (best signal)
    if (dto.linkedDocType && dto.linkedDocId) {
      if (dto.linkedDocType === FinanceLinkedDocType.SUPPLY) {
        const supply = await this.prisma.scmSupply.findUnique({
          where: { id: dto.linkedDocId },
          select: {
            brandId: true,
            warehouse: { select: { countryId: true } },
          } as any,
        });
        const le = await resolveFromBrandCountry(
          (supply as any)?.brandId ?? null,
          (supply as any)?.warehouse?.countryId ?? null,
        );
        if (le) return le;
      }
      if (dto.linkedDocType === FinanceLinkedDocType.PRODUCTION_ORDER) {
        const po = await this.prisma.productionOrder.findUnique({
          where: { id: dto.linkedDocId },
          select: {
            ScmProduct: { select: { brandId: true } },
            warehouses_production_orders_warehouseIdTowarehouses: {
              select: { countryId: true },
            },
          } as any,
        });
        const le = await resolveFromBrandCountry(
          (po as any)?.ScmProduct?.brandId ?? null,
          (po as any)?.warehouses_production_orders_warehouseIdTowarehouses
            ?.countryId ?? null,
        );
        if (le) return le;
      }
      if (dto.linkedDocType === FinanceLinkedDocType.SALES_DOCUMENT) {
        const sd = await (this.prisma as any).salesDocument.findUnique({
          where: { id: dto.linkedDocId },
          select: { brandId: true, countryId: true },
        });
        const le = await resolveFromBrandCountry(
          sd?.brandId ?? null,
          sd?.countryId ?? null,
        );
        if (le) return le;
      }
    }

    // Fallback: direct relations present on FinancialDocument
    if (dto.scmSupplyId) {
      const supply = await this.prisma.scmSupply.findUnique({
        where: { id: dto.scmSupplyId },
        select: {
          brandId: true,
          warehouse: { select: { countryId: true } },
        } as any,
      });
      const le = await resolveFromBrandCountry(
        (supply as any)?.brandId ?? null,
        (supply as any)?.warehouse?.countryId ?? null,
      );
      if (le) return le;
    }

    if (dto.productionOrderId) {
      const po = await this.prisma.productionOrder.findUnique({
        where: { id: dto.productionOrderId },
        select: {
          ScmProduct: { select: { brandId: true } },
          warehouses_production_orders_warehouseIdTowarehouses: {
            select: { countryId: true },
          },
        } as any,
      });
      const le = await resolveFromBrandCountry(
        (po as any)?.ScmProduct?.brandId ?? null,
        (po as any)?.warehouses_production_orders_warehouseIdTowarehouses
          ?.countryId ?? null,
      );
      if (le) return le;
    }

    return null;
  }

  async findAll(filters?: FinancialDocumentFiltersDto) {
    const where: Prisma.FinancialDocumentWhereInput = {};

    if ((filters as any)?.legalEntityId) {
      (where as any).legalEntityId = (filters as any).legalEntityId;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if ((filters as any)?.accrualStatus) {
      const v = String((filters as any).accrualStatus)
        .toUpperCase()
        .trim();
      if (v === 'ACCRUED') (where as any).isAccrued = true;
      if (v === 'NOT_ACCRUED') (where as any).isAccrued = false;
    }

    if (filters?.direction) {
      where.direction = filters.direction;
    }

    if (filters?.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }

    if (filters?.scmSupplyId) {
      where.scmSupplyId = filters.scmSupplyId;
    }

    // Date range filter
    if (filters?.fromDate || filters?.toDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.fromDate) {
        dateFilter.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        dateFilter.lte = new Date(filters.toDate);
      }
      where.OR = [
        { docDate: dateFilter },
        { date: dateFilter },
        { createdAt: dateFilter },
      ];
    }

    // Search by document number or external ID
    if (filters?.search) {
      where.OR = [
        ...(where.OR || []),
        {
          docNumber: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          number: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          externalId: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const take = Math.min(Number(filters?.limit) || 20, 100);
    const offset = filters?.offset ?? 0;

    const [documents, total] = await Promise.all([
      this.prisma.financialDocument.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          productionOrder: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          scmSupply: {
            select: {
              id: true,
              code: true,
            },
          },
          _count: {
            select: {
              services: true,
            },
          },
        },
        orderBy: [{ docDate: 'desc' }, { date: 'desc' }, { createdAt: 'desc' }],
        take,
        skip: offset,
      }),
      this.prisma.financialDocument.count({ where }),
    ]);

    return {
      items: documents.map((doc) => ({
        id: doc.id,
        docNumber: doc.docNumber || doc.number,
        docDate: doc.docDate || doc.date,
        type: doc.type,
        direction: doc.direction,
        status: doc.status,
        legalEntityId: (doc as any).legalEntityId,
        pnlCategoryId: (doc as any).pnlCategoryId ?? null,
        cashflowCategoryId: (doc as any).cashflowCategoryId ?? null,
        capitalizationPolicy: (doc as any).capitalizationPolicy ?? null,
        recognizedFrom: (doc as any).recognizedFrom ?? null,
        recognizedTo: (doc as any).recognizedTo ?? null,
        number: doc.number, // legacy
        date: doc.date, // legacy
        issueDate: doc.issueDate,
        dueDate: doc.dueDate,
        paidDate: doc.paidDate,
        supplierId: doc.supplierId,
        supplier: doc.supplier,
        totalAmount: doc.amountTotal?.toNumber() || 0,
        amountPaid: doc.amountPaid?.toNumber() || 0,
        currency: doc.currency,
        productionOrderId: doc.productionOrderId,
        productionOrder: doc.productionOrder,
        scmSupplyId: doc.scmSupplyId,
        scmSupply: doc.scmSupply,
        supplyId: doc.scmSupplyId, // legacy
        supply: doc.scmSupply, // legacy
        purchaseId: doc.purchaseId,
        expenseId: doc.expenseId,
        linkedDocType: doc.linkedDocType,
        linkedDocId: doc.linkedDocId,
        externalId: doc.externalId,
        fileUrl: doc.fileUrl,
        notes: doc.notes || doc.comment,
        comment: doc.comment, // legacy
        servicesCount: doc._count.services,
        isAutoCreated: doc.isAutoCreated,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      total,
    };
  }

  private immediateExpenseDebitAccount(
    docType?: FinancialDocumentType | null,
  ): string {
    switch (docType) {
      case (FinancialDocumentType as any).MARKETING:
        return ACCOUNTING_ACCOUNTS.MARKETING_EXPENSES;
      case (FinancialDocumentType as any).RENT:
      default:
        return ACCOUNTING_ACCOUNTS.RENT_EXPENSE;
    }
  }

  async accrueDocument(params: {
    id: string;
    tx?: Prisma.TransactionClient;
    postingDate?: Date;
  }) {
    const client = params.tx ?? this.prisma;
    const doc = await client.financialDocument.findUnique({
      where: { id: params.id },
    });
    if (!doc) throw new NotFoundException('Financial document not found');

    // Special contract: SupplyInvoice linked to SupplyReceipt must NOT duplicate Inventory/AP posting.
    if (
      doc.type === FinancialDocumentType.SUPPLY_INVOICE &&
      doc.linkedDocType === FinanceLinkedDocType.SUPPLY_RECEIPT
    ) {
      if ((doc as any).isAccrued) {
        return {
          document: doc,
          alreadyAccrued: true,
          entries: [],
          satisfiedByReceipt: true,
        };
      }

      if (!doc.linkedDocId) {
        throw new BadRequestException(
          'SUPPLY_INVOICE must have linkedDocId (supplyReceiptId)',
        );
      }

      // Posting-run idempotency still used for delta entry creation.
      const run = await this.postingRuns.getOrCreatePostedRun({
        tx: client as any,
        legalEntityId: doc.legalEntityId,
        docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
        docId: doc.id,
      });

      const receiptEntry = await client.accountingEntry.findFirst({
        where: {
          docType: AccountingDocType.SUPPLY_RECEIPT,
          docId: doc.linkedDocId,
        } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });

      if (receiptEntry) {
        if (!doc.currency || !doc.amountTotal) {
          throw new BadRequestException(
            'FinancialDocument.currency and amountTotal are required',
          );
        }
        if (
          String(doc.currency).toUpperCase().trim() !==
          String(receiptEntry.currency).toUpperCase().trim()
        ) {
          throw new UnprocessableEntityException(
            'SUPPLY_INVOICE currency must match SUPPLY_RECEIPT currency (MVP)',
          );
        }

        const inv = new Prisma.Decimal(doc.amountTotal as any);
        const rec = new Prisma.Decimal(receiptEntry.amount as any);
        const delta = inv.sub(rec);

        const entries: any[] = [];
        if (!delta.isZero()) {
          const lineNumber = await getNextLineNumber(
            client as any,
            AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
            doc.id,
          );
          const abs = delta.abs();
          const debit = delta.gt(0)
            ? ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS
            : ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_SUPPLIERS;
          const credit = delta.gt(0)
            ? ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_SUPPLIERS
            : ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS;

          const e = await this.accountingEntries.createEntry({
            tx: client as any,
            docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
            docId: doc.id,
            legalEntityId: doc.legalEntityId,
            lineNumber,
            postingDate: params.postingDate
              ? new Date(params.postingDate)
              : new Date(),
            debitAccount: debit,
            creditAccount: credit,
            amount: abs,
            currency: doc.currency,
            description: `SupplyInvoice delta vs SupplyReceipt (${doc.linkedDocId})`,
            metadata: {
              docLineId: `supply_invoice_delta:${doc.id}`,
              financialDocumentId: doc.id,
              supplyReceiptId: doc.linkedDocId,
              receiptEntryId: receiptEntry.id,
            },
            postingRunId: run.id,
          });
          entries.push(e);
        }

        const updatedDoc = await client.financialDocument.update({
          where: { id: doc.id },
          data: {
            isAccrued: true,
            accruedAt: new Date(),
            isAccruedToAP: true,
          } as any,
        });

        return {
          document: updatedDoc,
          alreadyAccrued: false,
          entries,
          satisfiedByReceipt: true,
          receiptEntryId: receiptEntry.id,
        };
      }

      // Edge-case: receipt entry missing -> fall through to standard accrual engine below (will post Inventory/AP).
    }

    // Posting-run idempotency
    const run = await this.postingRuns.getOrCreatePostedRun({
      tx: client as any,
      legalEntityId: doc.legalEntityId,
      docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
      docId: doc.id,
    });
    const has = await this.postingRuns.hasEntries({
      tx: client as any,
      runId: run.id,
    });
    if (has) {
      const existingEntries = await client.accountingEntry.findMany({
        where: { postingRunId: run.id } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });
      // keep document flags consistent
      if (!(doc as any).isAccrued) {
        await client.financialDocument.update({
          where: { id: doc.id },
          data: {
            isAccrued: true,
            accruedAt: (doc as any).accruedAt ?? new Date(),
            isAccruedToAP: true,
          } as any,
        });
      }
      return {
        document: doc,
        alreadyAccrued: true,
        entries: existingEntries,
        postingRunId: run.id,
      };
    }

    if (!doc.currency) {
      throw new BadRequestException('FinancialDocument.currency is required');
    }
    if (!doc.amountTotal) {
      throw new BadRequestException(
        'FinancialDocument.amountTotal is required',
      );
    }
    if (!(doc as any).cashflowCategoryId) {
      throw new UnprocessableEntityException(
        'cashflowCategoryId is required for accrual',
      );
    }

    const policy =
      doc.capitalizationPolicy as any as FinanceCapitalizationPolicy;
    if (
      policy === FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE &&
      !(doc as any).pnlCategoryId
    ) {
      throw new UnprocessableEntityException(
        'pnlCategoryId is required for immediate expense accrual',
      );
    }
    if (policy === FinanceCapitalizationPolicy.PREPAID_EXPENSE) {
      if (!doc.recognizedFrom || !doc.recognizedTo) {
        throw new UnprocessableEntityException(
          'recognizedFrom/recognizedTo are required for PREPAID_EXPENSE',
        );
      }
      const from = new Date(doc.recognizedFrom);
      const to = new Date(doc.recognizedTo);
      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        to <= from
      ) {
        throw new UnprocessableEntityException(
          'recognizedTo must be > recognizedFrom',
        );
      }
    }

    const postingDate = params.postingDate
      ? new Date(params.postingDate)
      : new Date();
    const debitAccount =
      policy === FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE
        ? this.immediateExpenseDebitAccount(doc.type as any)
        : policy === FinanceCapitalizationPolicy.PREPAID_EXPENSE
          ? ACCOUNTING_ACCOUNTS.PREPAID_EXPENSE_ASSET
          : policy === FinanceCapitalizationPolicy.FIXED_ASSET
            ? ACCOUNTING_ACCOUNTS.FIXED_ASSET
            : policy === (FinanceCapitalizationPolicy as any).INTANGIBLE
              ? ACCOUNTING_ACCOUNTS.INTANGIBLE_ASSET
              : ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS;

    const lineNumber = await getNextLineNumber(
      client as any,
      AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
      doc.id,
    );

    const entry = await this.accountingEntries.createEntry({
      tx: client as any,
      docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
      docId: doc.id,
      legalEntityId: doc.legalEntityId,
      lineNumber,
      postingDate,
      debitAccount,
      creditAccount: ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_SUPPLIERS,
      amount: doc.amountTotal as any,
      currency: doc.currency,
      description: `Accrual for document ${doc.id} (${policy})`,
      metadata: {
        docLineId: `financial_document:${doc.id}:accrual:run:${run.id}`,
        financialDocumentId: doc.id,
        capitalizationPolicy: policy,
        pnlCategoryId: (doc as any).pnlCategoryId ?? null,
        cashflowCategoryId: (doc as any).cashflowCategoryId ?? null,
        recognizedFrom: doc.recognizedFrom ?? null,
        recognizedTo: doc.recognizedTo ?? null,
      },
      postingRunId: run.id,
    });

    const updatedDoc = await client.financialDocument.update({
      where: { id: doc.id },
      data: {
        isAccrued: true,
        accruedAt: new Date(),
        isAccruedToAP: true, // legacy compatibility
      } as any,
    });

    // Auto-create / upsert recurring journal for recognition / depreciation (TZ 6.3)
    if (policy === FinanceCapitalizationPolicy.PREPAID_EXPENSE) {
      const monthsCount = Math.max(
        1,
        (new Date(doc.recognizedTo as any).getUTCFullYear() -
          new Date(doc.recognizedFrom as any).getUTCFullYear()) *
          12 +
          (new Date(doc.recognizedTo as any).getUTCMonth() -
            new Date(doc.recognizedFrom as any).getUTCMonth()) +
          1,
      );
      const perMonth = new Prisma.Decimal(doc.amountTotal as any)
        .div(monthsCount)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const perMonthBase = new Prisma.Decimal((doc.amountTotalBase as any) ?? 0)
        .div(monthsCount)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      await this.recurring.upsertFromDocument({
        tx: client as any,
        legalEntityId: doc.legalEntityId,
        sourceDocumentId: doc.id,
        journalType: RecurringJournalType.PREPAID_RECOGNITION,
        startDate: new Date(doc.recognizedFrom as any),
        endDate: new Date(doc.recognizedTo as any),
        amount: perMonth,
        currency: doc.currency,
        amountBase: perMonthBase,
        debitAccountId: this.immediateExpenseDebitAccount(doc.type as any),
        creditAccountId: ACCOUNTING_ACCOUNTS.PREPAID_EXPENSE_ASSET,
        pnlCategoryId: (doc as any).pnlCategoryId ?? null,
      });
    }
    if (
      policy === FinanceCapitalizationPolicy.FIXED_ASSET ||
      policy === (FinanceCapitalizationPolicy as any).INTANGIBLE
    ) {
      const ulm = (doc as any).usefulLifeMonths ?? null;
      if (!ulm || ulm <= 0) {
        throw new UnprocessableEntityException(
          'usefulLifeMonths is required for asset amortization/depreciation',
        );
      }
      const perMonth = new Prisma.Decimal(doc.amountTotal as any)
        .div(new Prisma.Decimal(ulm))
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const perMonthBase = new Prisma.Decimal((doc.amountTotalBase as any) ?? 0)
        .div(new Prisma.Decimal(ulm))
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      await this.recurring.upsertFromDocument({
        tx: client as any,
        legalEntityId: doc.legalEntityId,
        sourceDocumentId: doc.id,
        journalType:
          policy === FinanceCapitalizationPolicy.FIXED_ASSET
            ? RecurringJournalType.DEPRECIATION
            : RecurringJournalType.AMORTIZATION,
        startDate: params.postingDate
          ? new Date(params.postingDate)
          : new Date(),
        endDate: null,
        amount: perMonth,
        currency: doc.currency,
        amountBase: perMonthBase,
        debitAccountId:
          policy === FinanceCapitalizationPolicy.FIXED_ASSET
            ? ACCOUNTING_ACCOUNTS.DEPRECIATION_EXPENSE
            : ACCOUNTING_ACCOUNTS.AMORTIZATION_EXPENSE,
        creditAccountId:
          policy === FinanceCapitalizationPolicy.FIXED_ASSET
            ? ACCOUNTING_ACCOUNTS.ACCUMULATED_DEPRECIATION
            : ACCOUNTING_ACCOUNTS.ACCUMULATED_AMORTIZATION,
        pnlCategoryId: (doc as any).pnlCategoryId ?? null,
      });
    }

    return { document: updatedDoc, alreadyAccrued: false, entries: [entry] };
  }

  async batchAccrue(params: {
    legalEntityId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const take = Math.min(params.limit ?? 50, 200);
    const where: any = { isAccrued: false };
    if (params.legalEntityId) where.legalEntityId = params.legalEntityId;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }

    const docs = await this.prisma.financialDocument.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }],
      take,
    });

    const results: any[] = [];
    for (const d of docs) {
      const r = await this.prisma.$transaction((tx) =>
        this.accrueDocument({ id: d.id, tx }),
      );
      results.push(r);
    }

    return { processed: docs.length, results };
  }

  async voidAccrual(params: { id: string; reason: string }) {
    const doc = await this.prisma.financialDocument.findUnique({
      where: { id: params.id },
    });
    if (!doc) throw new NotFoundException('Financial document not found');

    // guard: do not allow void if there is any payment execution for this document
    const hasPayment = await (this.prisma as any).paymentExecution.findFirst({
      where: {
        paymentPlan: { paymentRequest: { financialDocumentId: doc.id } },
      } as any,
      select: { id: true },
    });
    if (hasPayment) {
      throw new ConflictException('Cannot void accrual: document has payments');
    }

    return this.prisma.$transaction(async (tx) => {
      const active = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId: doc.legalEntityId,
        docType: AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
        docId: doc.id,
      });
      if (!active) {
        // idempotent: nothing to void
        await tx.financialDocument.update({
          where: { id: doc.id },
          data: {
            isAccrued: false,
            accruedAt: null,
            isAccruedToAP: false,
          } as any,
        });
        return { voided: false, reason: 'no active accrual run' };
      }

      await this.postingRuns.voidRun({
        tx,
        runId: active.id,
        reason: params.reason,
      });

      await tx.financialDocument.update({
        where: { id: doc.id },
        data: {
          isAccrued: false,
          accruedAt: null,
          isAccruedToAP: false,
        } as any,
      });

      return { voided: true, runId: active.id };
    });
  }
  async findOne(id: string) {
    const document = await this.prisma.financialDocument.findUnique({
      where: { id },
      include: {
        supplier: true,
        productionOrder: true,
        scmSupply: true,
        services: true,
        _count: { select: { services: true } },
      },
    });
    if (!document) {
      throw new NotFoundException('Financial document not found');
    }
    return document;
  }

  async attachService(id: string, dto: AttachServiceDto) {
    const document = await this.prisma.financialDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Financial document with ID ${id} not found`);
    }

    // Verify all services exist
    for (const serviceId of dto.serviceIds) {
      const service = await this.prisma.scmServiceOperation.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        throw new NotFoundException(
          `Service operation with ID ${serviceId} not found`,
        );
      }
    }

    // Update all services to link them to this document
    await this.prisma.scmServiceOperation.updateMany({
      where: {
        id: {
          in: dto.serviceIds,
        },
      },
      data: {
        financialDocumentId: id,
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const document = await this.prisma.financialDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(`Financial document with ID ${id} not found`);
    }

    return this.prisma.financialDocument.delete({
      where: { id },
    });
  }
}
