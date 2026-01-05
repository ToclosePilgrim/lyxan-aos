import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { OsApiResponse, ok, fail } from '../os/os-api.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('os-events')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1/events')
export class OsEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Poll OS events' })
  async list(
    @Query('types') types?: string,
    @Query('status') status?: string,
    @Query('afterId') afterId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<OsApiResponse<{ items: any[]; total: number }>> {
    try {
      const take = Math.min(Number(pageSize) || 50, 200);
      const skip = ((Number(page) || 1) - 1) * take;
      const where: any = {};
      if (status) where.status = status as any;
      if (types) {
        const typeList = types
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        where.type = { in: typeList };
      }
      if (afterId) {
        where.id = { gt: afterId };
      }
      const [items, total] = await Promise.all([
        this.prisma.osEvent.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          take,
          skip,
        }),
        this.prisma.osEvent.count({ where }),
      ]);
      return ok({ items, total });
    } catch (e: any) {
      return fail(
        'OS_EVENTS_FETCH_FAILED',
        e?.message ?? 'Failed to fetch events',
      );
    }
  }

  @Post('ack')
  @ApiOperation({ summary: 'Acknowledge events as delivered' })
  async ack(
    @Body() body: { eventIds: string[] },
  ): Promise<OsApiResponse<{ updated: number }>> {
    try {
      const updated = await this.prisma.osEvent.updateMany({
        where: { id: { in: body.eventIds || [] }, status: 'PENDING' as any },
        data: { status: 'DELIVERED' as any },
      });
      return ok({ updated: updated.count });
    } catch (e: any) {
      return fail('OS_EVENTS_ACK_FAILED', e?.message ?? 'Failed to ack events');
    }
  }
}

