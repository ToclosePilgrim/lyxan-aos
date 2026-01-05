import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { ExplainService } from './explain.service';
import { ExplainController } from './explain.controller';

@Module({
  imports: [DatabaseModule],
  providers: [ExplainService],
  controllers: [ExplainController],
  exports: [ExplainService],
})
export class ExplainModule {}

