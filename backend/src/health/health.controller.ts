import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    const version =
      process.env.VERSION ??
      process.env.GIT_SHA ??
      process.env.GITHUB_SHA ??
      null;

    return {
      status: 'ok',
      service: 'aos-backend',
      version,
      time: new Date().toISOString(),
    };
  }

  @Get('db')
  async getDbHealth() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'ok',
        time: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown DB error';
      return {
        status: 'error',
        db: 'error',
        time: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message,
      };
    }
  }
}
