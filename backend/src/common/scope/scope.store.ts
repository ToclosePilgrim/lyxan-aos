import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestScope } from './scope.types';

/**
 * AsyncLocalStorage store for request scope
 * Allows accessing scope from anywhere in the request context without passing it explicitly
 */
class ScopeStore {
  private readonly als = new AsyncLocalStorage<RequestScope>();

  /**
   * Run a function with a scope context
   */
  run<T>(scope: RequestScope, fn: () => T): T {
    return this.als.run(scope, fn);
  }

  /**
   * Get current scope from AsyncLocalStorage
   * Returns null if no scope is set (e.g., outside request context)
   */
  getScope(): RequestScope | null {
    return this.als.getStore() ?? null;
  }

  /**
   * Get current scope or throw if not set
   * Use this when scope is required (e.g., in Prisma extension)
   */
  getScopeOrThrow(): RequestScope {
    const scope = this.getScope();
    if (!scope) {
      throw new Error(
        'Request scope not found. Ensure ScopeInterceptor is registered globally.',
      );
    }
    return scope;
  }
}

export const scopeStore = new ScopeStore();


