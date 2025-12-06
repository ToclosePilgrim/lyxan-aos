import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './database/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrgModule } from './modules/org/org.module';
import { ScmModule } from './modules/scm/scm.module';
import { BcmModule } from './modules/bcm/bcm.module';
import { FinanceModule } from './modules/finance/finance.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { SupportModule } from './modules/support/support.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AgentsModule } from './modules/agents/agents.module';
import { IntegrationLogsModule } from './modules/integration-logs/integration-logs.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    OrgModule,
    ScmModule,
    BcmModule,
    FinanceModule,
    AdvertisingModule,
    SupportModule,
    AnalyticsModule,
    SettingsModule,
    AgentsModule,
    IntegrationLogsModule,
    HealthModule,
  ],
})
export class AppModule {}
