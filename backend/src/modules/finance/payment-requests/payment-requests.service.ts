import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceLinkedDocType,
  PaymentRequestStatus,
  PaymentRequestType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';
import { FinanceCategoryResolverService } from '../category-default-mappings/category-resolver.service';
import { FinanceCategoryMappingSourceType } from '@prisma/client';

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
    private readonly categoryResolver: FinanceCategoryResolverService,
  ) {}

  private normalizeCurrency(currency: string) {
    const c = (currency ?? '').toUpperCase().trim();
    if (!c || c.length !== 3) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    return c;
  }

  private async resolveLegalEntityId(input: {
    legalEntityId?: string;
    financialDocumentId?: string;
    linkedDocType?: FinanceLinkedDocType;
    linkedDocId?: string;
  }) {
    if (input.legalEntityId) return input.legalEntityId;
    if (input.financialDocumentId) {
      const doc = await this.prisma.financialDocument.findUnique({
        where: { id: input.financialDocumentId },
        select: { legalEntityId: true },
      });
      if (!doc) throw new NotFoundException('FinancialDocument not found');
      return doc.legalEntityId;
    }
    // For MVP we do not enforce linked doc existence; but if linkedDocType is known,
    // we can still try to derive legalEntityId.
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

    if (input.linkedDocType && input.linkedDocId) {
      if (input.linkedDocType === FinanceLinkedDocType.SUPPLY) {
        const supply = await this.prisma.scmSupply.findUnique({
          where: { id: input.linkedDocId },
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
      if (input.linkedDocType === FinanceLinkedDocType.PRODUCTION_ORDER) {
        const po = await this.prisma.productionOrder.findUnique({
          where: { id: input.linkedDocId },
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
    }

    return null;
  }

  private ensureBasisOrThrow(input: {
    financialDocumentId?: string;
    linkedDocType?: FinanceLinkedDocType;
    linkedDocId?: string;
  }) {
    const hasDoc = !!input.financialDocumentId;
    const hasLinked = !!input.linkedDocType && !!input.linkedDocId;
    if (!hasDoc && !hasLinked) {
      throw new BadRequestException(
        'PaymentRequest must have financialDocumentId or linkedDocType+linkedDocId',
      );
    }
  }

  async create(dto: {
    legalEntityId?: string;
    type: PaymentRequestType;
    amount: Prisma.Decimal | string | number;
    currency: string;
    plannedPayDate: Date;
    priority?: number;
    counterpartyId?: string;
    financialDocumentId?: string;
    linkedDocType?: FinanceLinkedDocType;
    linkedDocId?: string;
    cashflowCategoryId?: string;
    pnlCategoryId?: string;
    description?: string;
    attachments?: any;
    requestedByUserId?: string;
  }) {
    this.ensureBasisOrThrow(dto);
    const currency = this.normalizeCurrency(dto.currency);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('amount must be > 0');
    const plannedPayDate = new Date(dto.plannedPayDate);
    if (Number.isNaN(plannedPayDate.getTime())) {
      throw new BadRequestException('plannedPayDate is invalid');
    }

    const legalEntityId = await this.resolveLegalEntityId(dto);
    if (!legalEntityId) {
      throw new BadRequestException(
        'Cannot resolve legalEntityId; provide explicitly or link to scoped doc',
      );
    }
    const le = await (this.prisma as any).legalEntity.findUnique({
      where: { id: legalEntityId },
      select: { id: true },
    });
    if (!le) throw new NotFoundException('LegalEntity not found');

    // Derive categories from financialDocument if present (best-effort)
    let pnlCategoryId = dto.pnlCategoryId ?? null;
    let cashflowCategoryId = dto.cashflowCategoryId ?? null;
    if (dto.financialDocumentId) {
      const doc = await this.prisma.financialDocument.findUnique({
        where: { id: dto.financialDocumentId },
        select: { pnlCategoryId: true, cashflowCategoryId: true },
      });
      pnlCategoryId = pnlCategoryId ?? doc?.pnlCategoryId ?? null;
      cashflowCategoryId =
        cashflowCategoryId ?? doc?.cashflowCategoryId ?? null;
    }

    // If still missing cashflowCategoryId, try default mapping by PaymentRequest type
    if (!cashflowCategoryId) {
      const resolved = await this.categoryResolver.resolveDefaults({
        legalEntityId,
        sourceType: FinanceCategoryMappingSourceType.PAYMENT_REQUEST_TYPE,
        sourceCode: String(dto.type ?? '').toUpperCase(),
      });
      cashflowCategoryId = resolved.cashflowCategoryId;
      // pnlCategoryId is optional for payment requests (depends on doc); keep only if resolved provides
      pnlCategoryId = pnlCategoryId ?? resolved.pnlCategoryId;
    }
    if (!cashflowCategoryId) {
      throw new BadRequestException('cashflowCategoryId is required');
    }

    const amountBase = await this.currencyRates.convertToBase({
      amount,
      currency,
      date: plannedPayDate,
    });

    return this.prisma.paymentRequest.create({
      data: {
        legalEntityId,
        type: dto.type,
        status: PaymentRequestStatus.DRAFT,
        amount,
        currency,
        amountBase,
        plannedPayDate,
        priority: dto.priority ?? 1,
        counterpartyId: dto.counterpartyId ?? null,
        financialDocumentId: dto.financialDocumentId ?? null,
        linkedDocType: dto.linkedDocType ?? null,
        linkedDocId: dto.linkedDocId ?? null,
        cashflowCategoryId,
        pnlCategoryId,
        description: dto.description ?? null,
        attachments: dto.attachments ?? null,
        requestedByUserId: dto.requestedByUserId ?? null,
      } as any,
    });
  }

  async update(id: string, dto: any) {
    const pr = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    if (pr.status !== PaymentRequestStatus.DRAFT) {
      throw new ConflictException('Only DRAFT payment request can be updated');
    }

    const nextCurrency =
      dto.currency !== undefined
        ? this.normalizeCurrency(dto.currency)
        : pr.currency;
    const nextAmount =
      dto.amount !== undefined
        ? new Prisma.Decimal(dto.amount)
        : new Prisma.Decimal(pr.amount as any);
    if (nextAmount.lte(0)) throw new BadRequestException('amount must be > 0');

    const nextPlannedPayDate =
      dto.plannedPayDate !== undefined
        ? new Date(dto.plannedPayDate)
        : pr.plannedPayDate;
    if (Number.isNaN(nextPlannedPayDate.getTime())) {
      throw new BadRequestException('plannedPayDate is invalid');
    }

    const nextBasis = {
      financialDocumentId:
        dto.financialDocumentId !== undefined
          ? dto.financialDocumentId
          : pr.financialDocumentId,
      linkedDocType:
        dto.linkedDocType !== undefined ? dto.linkedDocType : pr.linkedDocType,
      linkedDocId:
        dto.linkedDocId !== undefined ? dto.linkedDocId : pr.linkedDocId,
    };
    this.ensureBasisOrThrow(nextBasis as any);

    const amountBase = await this.currencyRates.convertToBase({
      amount: nextAmount,
      currency: nextCurrency,
      date: nextPlannedPayDate,
    });

    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        type: dto.type ?? undefined,
        amount: dto.amount !== undefined ? nextAmount : undefined,
        currency: dto.currency !== undefined ? nextCurrency : undefined,
        amountBase,
        plannedPayDate:
          dto.plannedPayDate !== undefined ? nextPlannedPayDate : undefined,
        priority: dto.priority ?? undefined,
        counterpartyId: dto.counterpartyId ?? undefined,
        financialDocumentId: dto.financialDocumentId ?? undefined,
        linkedDocType: dto.linkedDocType ?? undefined,
        linkedDocId: dto.linkedDocId ?? undefined,
        cashflowCategoryId: dto.cashflowCategoryId ?? undefined,
        pnlCategoryId: dto.pnlCategoryId ?? undefined,
        description: dto.description ?? undefined,
        attachments: dto.attachments ?? undefined,
      } as any,
    });
  }

  async list(filters?: {
    legalEntityId?: string;
    status?: PaymentRequestStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.PaymentRequestWhereInput = {};
    if (filters?.legalEntityId)
      (where as any).legalEntityId = filters.legalEntityId;
    if (filters?.status) (where as any).status = filters.status;
    if (filters?.from || filters?.to) {
      (where as any).plannedPayDate = {};
      if (filters.from) (where as any).plannedPayDate.gte = filters.from;
      if (filters.to) (where as any).plannedPayDate.lte = filters.to;
    }
    return this.prisma.paymentRequest.findMany({
      where,
      orderBy: [{ plannedPayDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string) {
    const pr = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    return pr;
  }

  async submit(id: string, submittedBy?: string) {
    const pr = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    if (pr.status !== PaymentRequestStatus.DRAFT) {
      throw new ConflictException(
        'Only DRAFT payment request can be submitted',
      );
    }
    this.ensureBasisOrThrow(pr as any);
    if (!pr.cashflowCategoryId) {
      throw new BadRequestException('cashflowCategoryId is required');
    }
    if (!pr.legalEntityId) {
      throw new BadRequestException('legalEntityId is required');
    }
    if (!pr.plannedPayDate) {
      throw new BadRequestException('plannedPayDate is required');
    }
    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedBy: submittedBy ?? null,
      } as any,
    });
  }

  private async findPolicy(pr: any) {
    const candidates = await this.prisma.financeApprovalPolicy.findMany({
      where: {
        legalEntityId: pr.legalEntityId,
        OR: [{ type: pr.type }, { type: null }],
      } as any,
      orderBy: [{ type: 'desc' as any }, { amountBaseFrom: 'desc' }],
    });
    const amountBase = new Prisma.Decimal(pr.amountBase);
    return (
      candidates.find((p: any) => {
        const from = new Prisma.Decimal(p.amountBaseFrom);
        const to =
          p.amountBaseTo !== null ? new Prisma.Decimal(p.amountBaseTo) : null;
        if (amountBase.lt(from)) return false;
        if (to && amountBase.gt(to)) return false;
        return true;
      }) ?? null
    );
  }

  async approve(
    id: string,
    input: { approvedBy: string; approverRole?: string },
  ) {
    const pr = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    if (pr.status !== PaymentRequestStatus.SUBMITTED) {
      throw new ConflictException(
        'Only SUBMITTED payment request can be approved',
      );
    }

    const policy = await this.findPolicy(pr);
    if (!policy) {
      throw new BadRequestException(
        'No approval policy configured for this request',
      );
    }

    if (!policy.isAutoApprove) {
      const approvedBy = (input.approvedBy ?? '').trim();
      if (!approvedBy) {
        throw new BadRequestException('approvedBy is required');
      }
      if (policy.approverRole) {
        const role = (input.approverRole ?? '').trim();
        if (!role || role !== policy.approverRole) {
          throw new BadRequestException(
            `Approval requires role ${policy.approverRole}`,
          );
        }
      }
    }

    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: input.approvedBy,
      } as any,
    });
  }

  async reject(id: string, input: { rejectedBy: string; reason: string }) {
    const pr = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    if (pr.status !== PaymentRequestStatus.SUBMITTED) {
      throw new ConflictException(
        'Only SUBMITTED payment request can be rejected',
      );
    }
    const reason = (input.reason ?? '').trim();
    if (!reason) throw new BadRequestException('reason is required');
    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedBy: input.rejectedBy,
        rejectReason: reason,
      } as any,
    });
  }

  async cancel(id: string, canceledBy?: string) {
    const pr = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    if (
      pr.status !== PaymentRequestStatus.DRAFT &&
      pr.status !== PaymentRequestStatus.SUBMITTED
    ) {
      throw new ConflictException(
        'Only DRAFT/SUBMITTED payment request can be canceled',
      );
    }
    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: PaymentRequestStatus.CANCELED,
        rejectedAt: pr.rejectedAt,
        rejectedBy: pr.rejectedBy,
        rejectReason: pr.rejectReason,
        // keep audit minimal for MVP; cancellation author can be stored in description later
        description: pr.description ?? null,
      } as any,
    });
  }
}
