import { Module } from '@nestjs/common';
import { ScmServicesController } from './scm-services.controller';
import { ScmServicesService } from './scm-services.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ScmServicesController],
  providers: [ScmServicesService],
  exports: [ScmServicesService],
})
export class ScmServicesModule {}




