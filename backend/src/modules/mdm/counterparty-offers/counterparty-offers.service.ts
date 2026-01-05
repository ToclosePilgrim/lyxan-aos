import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CounterpartyOfferStatus,
  CounterpartyOfferType,
  MdmItemType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MdmItemsService } from '../items/mdm-items.service';
import { CreateCounterpartyOfferDto } from './dto/create-counterparty-offer.dto';
import { UpdateCounterpartyOfferDto } from './dto/update-counterparty-offer.dto';

function mapOfferTypeToMdmItemType(t: CounterpartyOfferType): MdmItemType {
  if (t === CounterpartyOfferType.MATERIAL) return MdmItemType.MATERIAL;
  if (t === CounterpartyOfferType.SERVICE) return MdmItemType.SERVICE;
  return MdmItemType.PRODUCT;
}

@Injectable()
export class CounterpartyOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mdmItems: MdmItemsService,
  ) {}

  private toMoneyDecimal(
    value: number | undefined,
  ): Prisma.Decimal | undefined {
    if (value === undefined) return undefined;
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      throw new BadRequestException('price must be a finite number');
    }
    return new Prisma.Decimal(value);
  }

  private normalizeCurrency(currency: string) {
    return currency.trim().toUpperCase();
  }

  async create(dto: CreateCounterpartyOfferDto) {
    const legalEntity = await this.prisma.legalEntity.findUnique({
      where: { id: dto.legalEntityId },
      select: { id: true },
    });
    if (!legalEntity) {
      throw new NotFoundException(
        `LegalEntity with ID ${dto.legalEntityId} not found`,
      );
    }

    const counterparty = await this.prisma.counterparty.findUnique({
      where: { id: dto.counterpartyId },
      select: { id: true, roles: true },
    });
    if (!counterparty) {
      throw new NotFoundException(
        `Counterparty with ID ${dto.counterpartyId} not found`,
      );
    }

    let mdmItemId = dto.mdmItemId ?? null;

    // Infer offerType
    let offerType: CounterpartyOfferType | null = dto.offerType ?? null;

    if (!mdmItemId) {
      const itemType = dto.itemType ?? dto.offerType ?? null;
      if (!itemType) {
        throw new BadRequestException(
          'itemType is required when mdmItemId is not provided',
        );
      }
      if (!dto.itemName || !dto.itemName.trim()) {
        throw new BadRequestException(
          'itemName is required when mdmItemId is not provided',
        );
      }

      const item = await this.mdmItems.ensureItem(
        {
          type: mapOfferTypeToMdmItemType(itemType),
          code: dto.itemSku?.trim() || undefined,
          name: dto.itemName.trim(),
          unit: 'pcs',
        },
        undefined,
      );
      mdmItemId = item.id;
      offerType = offerType ?? itemType;
    } else {
      const item = await this.prisma.mdmItem.findUnique({
        where: { id: mdmItemId },
        select: { id: true, type: true },
      });
      if (!item) {
        throw new NotFoundException(`MdmItem with ID ${mdmItemId} not found`);
      }

      // Consistency guard (MVP, fail-soft): SERVICE offer must be linked to SERVICE item.
      if (
        (dto.offerType ?? null) === CounterpartyOfferType.SERVICE &&
        item.type !== MdmItemType.SERVICE
      ) {
        throw new UnprocessableEntityException(
          'OfferType SERVICE requires MdmItemType SERVICE',
        );
      }
      offerType =
        offerType ??
        (item.type === MdmItemType.MATERIAL
          ? CounterpartyOfferType.MATERIAL
          : item.type === MdmItemType.SERVICE
            ? CounterpartyOfferType.SERVICE
            : CounterpartyOfferType.PRODUCT);
    }

    // Basic role sanity for supplier-facing offers
    // (Counterparty is global in current model; we scope by legalEntityId on the offer itself)
    if (
      offerType === CounterpartyOfferType.MATERIAL ||
      offerType === CounterpartyOfferType.PRODUCT
    ) {
      if (!(counterparty.roles ?? []).includes('SUPPLIER' as any)) {
        throw new BadRequestException(
          'Counterparty must have role SUPPLIER to create MATERIAL/PRODUCT offers',
        );
      }
    }

    const currency = this.normalizeCurrency(dto.currency);
    const data: Prisma.CounterpartyOfferCreateInput = {
      legalEntity: { connect: { id: dto.legalEntityId } },
      counterparty: { connect: { id: dto.counterpartyId } },
      item: { connect: { id: mdmItemId } },
      offerType,
      status: CounterpartyOfferStatus.ACTIVE,
      isActive: true,
      name: dto.name?.trim() || dto.itemName?.trim() || null,
      vendorCode: dto.sku?.trim() || null,
      currencyCode: currency,
      price: this.toMoneyDecimal(dto.price),
      externalRef: dto.externalRef?.trim() || null,
    };

    // Idempotency
    const offer = await this.prisma.$transaction(async (tx) => {
      if (data.externalRef) {
        return tx.counterpartyOffer.upsert({
          where: {
            legalEntityId_counterpartyId_externalRef: {
              legalEntityId: dto.legalEntityId,
              counterpartyId: dto.counterpartyId,
              externalRef: data.externalRef,
            },
          },
          create: data,
          update: {
            offerType: data.offerType,
            status: data.status,
            isActive: data.isActive,
            name: data.name,
            vendorCode: data.vendorCode,
            currencyCode: data.currencyCode,
            price: data.price,
            item: { connect: { id: mdmItemId } },
          },
        });
      }

      return tx.counterpartyOffer.upsert({
        where: {
          legalEntityId_counterpartyId_itemId: {
            legalEntityId: dto.legalEntityId,
            counterpartyId: dto.counterpartyId,
            itemId: mdmItemId,
          },
        },
        create: data,
        update: {
          offerType: data.offerType,
          status: data.status,
          isActive: data.isActive,
          name: data.name,
          vendorCode: data.vendorCode,
          currencyCode: data.currencyCode,
          price: data.price,
          externalRef: data.externalRef,
        },
      });
    });

    return this.toDto(offer);
  }

  async findAll(filters: {
    legalEntityId: string;
    counterpartyId?: string;
    mdmItemId?: string;
    offerType?: CounterpartyOfferType;
    q?: string;
    includeArchived?: boolean;
  }) {
    const where: Prisma.CounterpartyOfferWhereInput = {
      legalEntityId: filters.legalEntityId,
    };

    if (!filters.includeArchived) {
      where.status = CounterpartyOfferStatus.ACTIVE;
    }

    if (filters.counterpartyId) where.counterpartyId = filters.counterpartyId;
    if (filters.mdmItemId) where.itemId = filters.mdmItemId;
    if (filters.offerType) where.offerType = filters.offerType;

    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { vendorCode: { contains: q, mode: 'insensitive' } },
        { externalRef: { contains: q, mode: 'insensitive' } },
      ];
    }

    const offers = await this.prisma.counterpartyOffer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return offers.map((o) => this.toDto(o));
  }

  async findOne(id: string, legalEntityId: string) {
    const offer = await this.prisma.counterpartyOffer.findUnique({
      where: { id },
    });
    if (!offer)
      throw new NotFoundException(`CounterpartyOffer ${id} not found`);
    if (offer.legalEntityId !== legalEntityId) {
      throw new NotFoundException(`CounterpartyOffer ${id} not found`);
    }
    return this.toDto(offer);
  }

  async update(
    id: string,
    legalEntityId: string,
    dto: UpdateCounterpartyOfferDto,
  ) {
    const offer = await this.prisma.counterpartyOffer.findUnique({
      where: { id },
    });
    if (!offer)
      throw new NotFoundException(`CounterpartyOffer ${id} not found`);
    if (offer.legalEntityId !== legalEntityId) {
      throw new NotFoundException(`CounterpartyOffer ${id} not found`);
    }

    const updateData: Prisma.CounterpartyOfferUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name?.trim() || null;
    if (dto.sku !== undefined) updateData.vendorCode = dto.sku?.trim() || null;
    if (dto.currency !== undefined) {
      updateData.currencyCode = this.normalizeCurrency(dto.currency);
    }
    if (dto.price !== undefined)
      updateData.price = this.toMoneyDecimal(dto.price);
    if (dto.externalRef !== undefined) {
      updateData.externalRef = dto.externalRef?.trim() || null;
    }
    if (dto.offerType !== undefined) updateData.offerType = dto.offerType;

    const updated = await this.prisma.counterpartyOffer.update({
      where: { id },
      data: updateData,
    });
    return this.toDto(updated);
  }

  async archive(id: string, legalEntityId: string) {
    const offer = await this.prisma.counterpartyOffer.findUnique({
      where: { id },
    });
    if (!offer)
      throw new NotFoundException(`CounterpartyOffer ${id} not found`);
    if (offer.legalEntityId !== legalEntityId) {
      throw new NotFoundException(`CounterpartyOffer ${id} not found`);
    }

    const updated = await this.prisma.counterpartyOffer.update({
      where: { id },
      data: {
        status: CounterpartyOfferStatus.ARCHIVED,
        isActive: false,
      },
    });
    return this.toDto(updated);
  }

  private toDto(offer: any) {
    return {
      id: offer.id,
      legalEntityId: offer.legalEntityId,
      counterpartyId: offer.counterpartyId,
      mdmItemId: offer.itemId,
      offerType: offer.offerType,
      name: offer.name,
      sku: offer.vendorCode,
      currency: offer.currencyCode,
      price: offer.price?.toNumber?.() ?? offer.price ?? null,
      externalRef: offer.externalRef,
      status: offer.status,
      isActive: offer.isActive,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }
}
