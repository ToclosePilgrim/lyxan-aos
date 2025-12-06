import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationLogsService } from './integration-logs.service';

@Module({
  imports: [DatabaseModule],
  providers: [IntegrationLogsService],
  exports: [IntegrationLogsService],
})
export class IntegrationLogsModule {}





