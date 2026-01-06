import { Module } from '@nestjs/common';
import { OsEventsService } from './os-events.service';
import { OsEventsController } from './os-events.controller';
import { PrismaService } from '../../database/prisma.service';

@Module({
  providers: [OsEventsService, PrismaService],
  controllers: [OsEventsController],
  exports: [OsEventsService],
})
export class OsEventsModule {}




