import { Module } from '@nestjs/common';
import { ScmStocksController } from './scm-stocks.controller';
import { ScmStocksService } from './scm-stocks.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ScmStocksController],
  providers: [ScmStocksService],
  exports: [ScmStocksService],
})
export class ScmStocksModule {}




