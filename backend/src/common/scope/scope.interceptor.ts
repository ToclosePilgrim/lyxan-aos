import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { scopeStore } from './scope.store';
import { RequestScope } from './scope.types';

/**
 * Interceptor that extracts user scope and stores it in AsyncLocalStorage
 * Must be registered globally after JwtAuthGuard
 */
@Injectable()
export class ScopeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ScopeInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const user = request.user;

    if (!user) {
      // No user - might be public endpoint, skip scope
      return next.handle();
    }

    // Determine if user is super admin
    const isSuperAdmin = user.role === 'SuperAdmin' || user.role === 'Admin';

    // Extract legalEntityId from user object (set by JWT strategy from JWT payload)
    let legalEntityId: string | null = user.legalEntityId ?? null;

    // If not found and not superadmin, try to get from database
    // For MVP: assume user can be linked to legalEntity through some relation
    // This is a placeholder - adjust based on your actual user-legalEntity relationship
    if (!legalEntityId && !isSuperAdmin) {
      // Try to get from user's first associated legalEntity
      // This is a simplified approach - adjust based on your schema
      try {
        // For now, we'll require legalEntityId to be in JWT or user object
        // If not present, throw error (deny-by-default)
        this.logger.warn(
          `User ${user.id} has no legalEntityId and is not superadmin`,
        );
        throw new ForbiddenException(
          'User scope not defined. legalEntityId is required.',
        );
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // If database query fails, deny access
        throw new ForbiddenException(
          'Unable to determine user scope. Access denied.',
        );
      }
    }

    // Build scope object
    const scope: RequestScope = {
      userId: user.id,
      isSuperAdmin,
      legalEntityId,
      // brandId and countryId can be added later if needed
      brandId: user.brandId ?? null,
      countryId: user.countryId ?? null,
    };

    // Validate scope for non-superadmin users
    if (!isSuperAdmin && !legalEntityId) {
      this.logger.warn(
        `User ${user.id} attempted access without legalEntityId`,
      );
      throw new ForbiddenException(
        'User scope not defined. legalEntityId is required for non-admin users.',
      );
    }

    // Store scope in AsyncLocalStorage and run handler
    return scopeStore.run(scope, () => {
      return next.handle().pipe(
        tap({
          error: (error) => {
            // Log scope violations if needed
            if (error.status === 403) {
              this.logger.warn(
                `Scope violation for user ${user.id}: ${error.message}`,
              );
            }
          },
        }),
      );
    });
  }
}

