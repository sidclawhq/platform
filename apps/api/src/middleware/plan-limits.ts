import { PrismaClient } from '../generated/prisma/index.js';
import { PlanLimitError } from '../errors.js';

const FREE_PLAN_LIMITS = {
  max_agents: 5,
  max_policies_per_agent: 10,
  max_api_keys: 2,
  max_webhook_endpoints: 1,
  max_users: 3,
  trace_retention_days: 7,
  rate_limit_evaluate_per_min: 100,
} as const;

const STARTER_PLAN_LIMITS = {
  max_agents: 15,
  max_policies_per_agent: 50,
  max_api_keys: 5,
  max_webhook_endpoints: 3,
  max_users: 10,
  trace_retention_days: 30,
  rate_limit_evaluate_per_min: 500,
} as const;

const BUSINESS_PLAN_LIMITS = {
  max_agents: 100,
  max_policies_per_agent: Infinity,
  max_api_keys: 20,
  max_webhook_endpoints: 10,
  max_users: 50,
  trace_retention_days: 90,
  rate_limit_evaluate_per_min: 5000,
} as const;

const ENTERPRISE_PLAN_LIMITS = {
  max_agents: Infinity,
  max_policies_per_agent: Infinity,
  max_api_keys: Infinity,
  max_webhook_endpoints: Infinity,
  max_users: Infinity,
  trace_retention_days: 365,
  rate_limit_evaluate_per_min: 50000,
} as const;

type PlanLimitName = keyof typeof FREE_PLAN_LIMITS;
type PlanLimits = Record<PlanLimitName, number>;

function getLimits(plan: string): PlanLimits {
  if (plan === 'enterprise') return ENTERPRISE_PLAN_LIMITS;
  if (plan === 'business') return BUSINESS_PLAN_LIMITS;
  if (plan === 'starter') return STARTER_PLAN_LIMITS;
  return FREE_PLAN_LIMITS;
}

export async function checkPlanLimit(
  prisma: PrismaClient,
  tenantId: string,
  limitName: PlanLimitName,
  currentCount: number
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });

  const limits = getLimits(tenant?.plan ?? 'free');
  const max = limits[limitName];

  if (max !== Infinity && currentCount >= max) {
    throw new PlanLimitError(limitName, currentCount, max);
  }
}

export { FREE_PLAN_LIMITS, STARTER_PLAN_LIMITS, BUSINESS_PLAN_LIMITS, ENTERPRISE_PLAN_LIMITS };
export type { PlanLimitName };
