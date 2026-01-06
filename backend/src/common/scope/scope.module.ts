import { Module, Global } from '@nestjs/common';
import { ScopeInterceptor } from './scope.interceptor';
import { ScopeHelperService } from './scope-helper.service';
import { DatabaseModule } from '../../database/database.module';

/**
 * Global scope module that provides scope isolation functionality
 * Must be imported after AuthModule to ensure user context is available
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ScopeInterceptor, ScopeHelperService],
  exports: [ScopeInterceptor, ScopeHelperService],
})
export class ScopeModule {}

