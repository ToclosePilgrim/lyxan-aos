import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { LegalEntitiesController } from './legal-entities.controller';
import { LegalEntitiesService } from './legal-entities.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService],
  exports: [LegalEntitiesService],
})
export class LegalEntitiesModule {}

