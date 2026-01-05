import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { MarketplaceIntegrationsController } from './marketplace-integrations.controller';
import { MarketplaceIntegrationsService } from './marketplace-integrations.service';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationLogsModule } from '../integration-logs/integration-logs.module';

@Module({
  imports: [DatabaseModule, IntegrationLogsModule],
  controllers: [SettingsController, MarketplaceIntegrationsController],
  providers: [SettingsService, MarketplaceIntegrationsService],
  exports: [SettingsService, MarketplaceIntegrationsService],
})
export class SettingsModule {}
