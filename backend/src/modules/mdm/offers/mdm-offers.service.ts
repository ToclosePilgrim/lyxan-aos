import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CounterpartyOffer } from '@prisma/client';

@Injectable()
export class MdmOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const offer = await this.prisma.counterpartyOffer.findUnique({
      where: { id },
    } as any);
    if (!offer) throw new NotFoundException(`MdmOffer with ID ${id} not found`);
    return offer as CounterpartyOffer;
  }
}
