import { Module } from '@nestjs/common';
import { OsRegistryService } from './os-registry.service';
import { OsRegistryController } from './os-registry.controller';
import { PrismaService } from '../../database/prisma.service';
import { OsSelfValidateService } from '../os/os-self-validate.service';

@Module({
  providers: [PrismaService, OsRegistryService, OsSelfValidateService],
  controllers: [OsRegistryController],
  exports: [OsRegistryService, OsSelfValidateService],
})
export class OsRegistryModule {}
