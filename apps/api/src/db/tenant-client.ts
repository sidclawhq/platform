import { PrismaClient } from '../generated/prisma/index.js';

/**
 * Models that do NOT have a tenant_id column and should be excluded from
 * automatic tenant scoping. These are system-level or cross-tenant models.
 */
const UNSCOPED_MODELS = new Set([
  'Tenant',
  'BackgroundJob',
  'WebhookDelivery',   // Scoped via endpoint_id FK to WebhookEndpoint
  'PolicyRuleVersion', // Scoped via policy_rule_id FK to PolicyRule
]);

/**
 * Creates a tenant-scoped Prisma client that automatically filters all queries
 * by tenant_id and sets tenant_id on all creates.
 *
 * This ensures application-level tenant isolation: every query through this
 * client is guaranteed to be scoped to the given tenant.
 *
 * Models without tenant_id (Tenant, BackgroundJob) are excluded from scoping.
 *
 * Note: Prisma's $extends type system is not fully compatible with PrismaClient
 * for complex operations (transactions, groupBy). Services accept PrismaClient
 * and routes cast the tenant client. The extension provides runtime isolation
 * guarantees regardless of TypeScript types.
 */
export function createTenantClient(basePrisma: PrismaClient, tenantId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: {
          model?: string;
          operation: string;
          args: Record<string, any>;
          query: (args: any) => Promise<any>;
        }) {
          // Skip unscoped models
          if (UNSCOPED_MODELS.has(model!)) {
            return query(args);
          }

          // Add tenant_id filter to read/update/delete operations
          const filterOps = [
            'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique',
            'findUniqueOrThrow', 'count', 'aggregate', 'groupBy',
            'updateMany', 'deleteMany', 'update', 'delete', 'upsert',
          ];
          if (filterOps.includes(operation)) {
            args.where = { ...args.where, tenant_id: tenantId };
          }

          // Set tenant_id on create operations
          if (operation === 'create') {
            args.data = { ...args.data, tenant_id: tenantId };
          }
          if (operation === 'createMany') {
            const data = args.data;
            args.data = Array.isArray(data)
              ? data.map((d: Record<string, unknown>) => ({ ...d, tenant_id: tenantId }))
              : { ...(data as Record<string, unknown>), tenant_id: tenantId };
          }
          if (operation === 'upsert') {
            args.create = { ...args.create, tenant_id: tenantId };
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Type for the tenant-scoped Prisma client.
 *
 * In practice, this is API-compatible with PrismaClient at runtime.
 * However, Prisma's conditional types prevent clean union types, so
 * services accept PrismaClient and routes cast via `as unknown as PrismaClient`.
 */
export type TenantPrismaClient = ReturnType<typeof createTenantClient>;
