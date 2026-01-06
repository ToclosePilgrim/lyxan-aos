import { Prisma } from '@prisma/client';
import { scopeStore } from './scope.store';
import { MODELS_WITH_LEGAL_ENTITY_ID, READ_OPERATIONS, ReadOperation } from './scope.types';

/**
 * Prisma Client extension (Prisma v6+) that automatically adds legalEntityId filter
 * to read operations for models that have legalEntityId field, unless user is superadmin.
 */
export function createScopeExtension() {
  return Prisma.defineExtension({
    name: 'aos-scope-extension',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Only apply scope to read operations
          if (!READ_OPERATIONS.includes(operation as ReadOperation)) {
            return query(args);
          }

          // Get current scope
          const scope = scopeStore.getScope();

          // If no scope or superadmin, skip filtering
          if (!scope || scope.isSuperAdmin) {
            return query(args);
          }

          // Check if model has legalEntityId field
          if (!MODELS_WITH_LEGAL_ENTITY_ID.includes(model as any)) {
            return query(args);
          }

          // If user has no legalEntityId, deny access (should not happen if interceptor works)
          if (!scope.legalEntityId) {
            throw new Error(
              'Cannot apply scope filter: legalEntityId is required but not set',
            );
          }

          const scopedArgs = addLegalEntityFilterToArgs(args, scope.legalEntityId);
          return query(scopedArgs);
        },
      },
    },
  });
}

/**
 * Adds legalEntityId filter to Prisma query args
 * Handles existing where clauses correctly (AND combination).
 */
export function addLegalEntityFilterToArgs(
  args: any,
  legalEntityId: string,
): any {
  const nextArgs = args ?? {};

  // If where already has legalEntityId, don't override (user explicitly set it)
  if (nextArgs.where?.legalEntityId) {
    return nextArgs;
  }

  // If where doesn't exist, create it
  if (!nextArgs.where) {
    return {
      ...nextArgs,
      where: { legalEntityId },
    };
  }

  // If where exists, combine with AND
  if (Array.isArray(nextArgs.where.AND)) {
    return {
      ...nextArgs,
      where: {
        ...nextArgs.where,
        AND: [...nextArgs.where.AND, { legalEntityId }],
      },
    };
  }

  // If where has other conditions, wrap in AND
  return {
    ...nextArgs,
    where: {
      AND: [nextArgs.where, { legalEntityId }],
    },
  };
}

