import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ListingVersionSource } from '@prisma/client';

export interface CreateListingVersionOptions {
  source?: ListingVersionSource;
  reason?: string;
  createdByUserId?: string | null;
}

@Injectable()
export class ListingVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createVersionForListing(
    listingId: string,
    options: CreateListingVersionOptions = {},
  ) {
    const listing = await this.prisma.product.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with id=${listingId} not found`);
    }

    // Находим номер следующей версии
    const lastVersion = await this.prisma.listingContentVersion.findFirst({
      where: { listingId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    return this.prisma.listingContentVersion.create({
      data: {
        listingId,
        marketplaceId: listing.marketplaceId ?? null,
        versionNumber: nextVersionNumber,
        source: options.source ?? ListingVersionSource.MANUAL,
        reason: options.reason ?? null,
        createdByUserId: options.createdByUserId ?? null,

        // Снапшот контентных полей
        title: listing.title,
        subtitle: listing.subtitle,
        shortDescription: listing.shortDescription,
        fullDescription: listing.fullDescription,
        keywords: listing.keywords,
        contentMeta: listing.contentMeta as any,
      },
    });
  }

  async getVersionsForListing(listingId: string) {
    return this.prisma.listingContentVersion.findMany({
      where: { listingId },
      orderBy: { versionNumber: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async getVersionById(id: string) {
    return this.prisma.listingContentVersion.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }
}

