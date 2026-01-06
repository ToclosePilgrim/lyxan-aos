import { Module } from '@nestjs/common';
import { OverheadRulesService } from './overhead-rules.service';
import { OverheadRulesController } from './overhead-rules.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [OverheadRulesController],
  providers: [OverheadRulesService],
  exports: [OverheadRulesService],
})
export class OverheadRulesModule {}




