import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  // ============ Reviews ============

  async getReviews(filters?: {
    rating?: number;
    minRating?: number;
    skuId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = {};

    if (filters?.rating !== undefined) {
      where.rating = filters.rating;
    } else if (filters?.minRating !== undefined) {
      where.rating = {
        gte: filters.minRating,
      };
    }

    if (filters?.skuId) {
      where.skuId = filters.skuId;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {};
      if (filters?.dateFrom) {
        where.date.gte = new Date(filters.dateFrom);
      }
      if (filters?.dateTo) {
        const dateToEnd = new Date(filters.dateTo);
        dateToEnd.setHours(23, 59, 59, 999);
        where.date.lte = dateToEnd;
      }
    }

    const reviews = await this.prisma.review.findMany({
      where,
      include: {
        sku: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return reviews;
  }

  async createReview(dto: CreateReviewDto) {
    // Validate SKU if provided
    if (dto.skuId) {
      const sku = await this.prisma.sku.findUnique({
        where: { id: dto.skuId },
      });

      if (!sku) {
        throw new NotFoundException(`SKU with ID ${dto.skuId} not found`);
      }
    }

    // Validate date
    const date = new Date(dto.date);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.prisma.review.create({
      data: {
        skuId: dto.skuId || null,
        rating: dto.rating,
        text: dto.text || null,
        date,
      },
      include: {
        sku: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // ============ Support Tickets ============

  async getTickets() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    return ticket;
  }

  async createTicket(dto: CreateTicketDto) {
    // Store title as first line of text, then full description
    // Since SupportTicket model only has text field, we'll combine title and text
    const fullText = `${dto.title}\n\n${dto.text}`;

    return this.prisma.supportTicket.create({
      data: {
        text: fullText,
        status: 'NEW',
      },
    });
  }

  async updateTicketStatus(id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        updatedAt: new Date(),
      },
    });
  }

  // Helper method to extract title from text (for backward compatibility)
  extractTitle(text: string): string {
    const lines = text.split('\n');
    return lines[0] || text.substring(0, 100);
  }

  // Helper method to extract body from text (for backward compatibility)
  extractBody(text: string): string {
    const lines = text.split('\n');
    if (lines.length > 1) {
      return lines.slice(2).join('\n').trim();
    }
    return text.substring(100);
  }
}
