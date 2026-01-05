import { Injectable, NotFoundException } from '@nestjs/common';
import { MdmItemType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import crypto from 'node:crypto';

@Injectable()
export class MdmItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const item = await this.prisma.mdmItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`MdmItem with ID ${id} not found`);
    return item;
  }

  private normalizeCode(code: string) {
    return code.trim();
  }

  private generateAutoCode(type: MdmItemType, name: string) {
    const base = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    const hash = crypto
      .createHash('sha1')
      .update(`${type}:${name.trim().toLowerCase()}`)
      .digest('hex')
      .slice(0, 8);
    return `AUTO_${type}_${base}_${hash}`;
  }

  async ensureItem(
    args: { type: MdmItemType; name: string; code?: string; unit?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const code = this.normalizeCode(
      args.code ?? this.generateAutoCode(args.type, args.name),
    );

    const existing = await client.mdmItem.findUnique({
      where: { type_code: { type: args.type, code } },
    });
    if (existing) return existing;

    return client.mdmItem.create({
      data: {
        type: args.type,
        code,
        name: args.name,
        unit: args.unit ?? null,
        isActive: true,
      },
    });
  }

  /**
   * Ensures there is an MDM item for a given SCM product and returns its MDM item id.
   *
   * Production output requires `ScmProduct.itemId` to be present to record inventory income.
   */
  async ensureItemForScmProduct(
    scmProductId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx ?? this.prisma;

    const product = await client.scmProduct.findUnique({
      where: { id: scmProductId },
      select: {
        id: true,
        itemId: true,
        sku: true,
        internalName: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `ScmProduct with ID ${scmProductId} not found`,
      );
    }

    if (product.itemId) {
      // Validate the target exists (defensive; should always be true if FK intact)
      const item = await client.mdmItem.findUnique({
        where: { id: product.itemId },
        select: { id: true },
      });
      if (!item) {
        // FK should prevent this, but keep the error explicit if DB got inconsistent
        throw new NotFoundException(
          `MdmItem with ID ${product.itemId} not found (linked from ScmProduct ${scmProductId})`,
        );
      }
      return product.itemId;
    }

    // Use a deterministic unique code for the PRODUCT item.
    // `MdmItem` is unique by (type, code), so include product id to avoid collisions.
    const code = product.sku
      ? `${product.sku}#${product.id.slice(0, 8)}`
      : `SCM_PRODUCT_${product.id.slice(0, 8)}`;

    const created = await client.mdmItem.create({
      data: {
        type: MdmItemType.PRODUCT,
        code,
        name:
          product.internalName || product.sku || `SCM Product ${product.id}`,
        unit: 'pcs',
      },
      select: { id: true },
    });

    try {
      await client.scmProduct.update({
        where: { id: scmProductId },
        data: { itemId: created.id },
        select: { id: true },
      });
    } catch (err: any) {
      // If someone else set itemId concurrently, prefer the existing linkage and try to cleanup the created item.
      try {
        const refreshed = await client.scmProduct.findUnique({
          where: { id: scmProductId },
          select: { itemId: true },
        });
        if (refreshed?.itemId) {
          await client.mdmItem
            .delete({ where: { id: created.id } })
            .catch(() => undefined);
          return refreshed.itemId;
        }
      } catch {
        // ignore
      }
      throw err;
    }

    return created.id;
  }
}
