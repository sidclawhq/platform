/**
 * Policy condition evaluator — runs after a matching policy rule is found.
 *
 * Supports four condition types beyond the base priority/scope match:
 *   - rate_limit: bounded actions-per-window
 *   - time_restriction: blocked hours or weekdays
 *   - cost_threshold: per-action or per-hour spend cap
 *   - webhook_check: external delegation (fail-closed if unreachable)
 *
 * Conditions live in PolicyRule.conditions (JSON). Multiple conditions on
 * one rule are all evaluated; a violation by any one of them can either
 * deny or force approval_required, depending on the condition's config.
 *
 * Added for the April 2026 competitive-response initiative.
 */

import type { PrismaClient } from '../generated/prisma/index.js';
import type { PolicyEffect } from '@sidclaw/shared';
import { safeFetch, UrlSafetyError } from '../lib/url-safety.js';

export type ConditionOutcome = 'satisfied' | 'violated';

export interface ConditionResult {
  type: string;
  outcome: ConditionOutcome;
  detail: string;
  on_violation: PolicyEffect;
}

export interface ConditionContext {
  tenant_id: string;
  agent_id: string;
  operation: string;
  target_integration: string;
}

interface RateLimitConfig {
  max_actions: number;
  window_minutes: number;
  action_types?: string[];
  on_exceed?: PolicyEffect; // default: 'approval_required'
}

interface TimeRestrictionConfig {
  action_types?: string[];
  blocked_hours?: number[]; // 0..23
  blocked_days?: string[]; // ['saturday', ...]
  timezone?: string; // IANA name, e.g. "America/New_York"
  on_violation?: PolicyEffect; // default: 'deny'
}

interface CostThresholdConfig {
  max_cost_per_action?: number;
  max_cost_per_hour?: number;
  currency?: string;
  on_exceed?: PolicyEffect; // default: 'approval_required'
}

interface WebhookCheckConfig {
  url: string;
  timeout_ms?: number;
  on_timeout?: PolicyEffect; // default: 'deny' — fail closed
  severity_direction?: 'escalate_only' | 'any'; // default: 'escalate_only'
}

export async function evaluateConditions(
  prisma: PrismaClient,
  rawConditions: unknown,
  context: ConditionContext,
  baseEffect: PolicyEffect,
  actionMetadata?: Record<string, unknown>,
): Promise<{ effect: PolicyEffect; results: ConditionResult[]; rationale: string | null }> {
  const results: ConditionResult[] = [];
  if (!rawConditions || typeof rawConditions !== 'object') {
    return { effect: baseEffect, results, rationale: null };
  }

  const conditions = rawConditions as Record<string, unknown>;
  let effectiveEffect: PolicyEffect = baseEffect;
  let violationRationale: string | null = null;

  for (const [type, config] of Object.entries(conditions)) {
    if (!config || typeof config !== 'object') continue;

    let result: ConditionResult;
    switch (type) {
      case 'rate_limit':
        result = await checkRateLimit(prisma, config as RateLimitConfig, context);
        break;
      case 'time_restriction':
        result = checkTimeRestriction(config as TimeRestrictionConfig, context);
        break;
      case 'cost_threshold':
        result = await checkCostThreshold(prisma, config as CostThresholdConfig, context, actionMetadata);
        break;
      case 'webhook_check':
        result = await checkWebhook(config as WebhookCheckConfig, context, actionMetadata);
        break;
      default:
        continue; // unknown condition type — ignore
    }
    results.push(result);

    if (result.outcome === 'violated') {
      // A violation escalates: deny > approval_required > allow
      effectiveEffect = mostRestrictive(effectiveEffect, result.on_violation);
      if (!violationRationale) violationRationale = result.detail;
    }
  }

  return { effect: effectiveEffect, results, rationale: violationRationale };
}

function mostRestrictive(a: PolicyEffect, b: PolicyEffect): PolicyEffect {
  const order: Record<PolicyEffect, number> = { allow: 0, approval_required: 1, deny: 2 };
  return order[a] > order[b] ? a : b;
}

async function checkRateLimit(
  prisma: PrismaClient,
  config: RateLimitConfig,
  context: ConditionContext,
): Promise<ConditionResult> {
  const onExceed = config.on_exceed ?? 'approval_required';
  if (!Number.isInteger(config.max_actions) || !Number.isInteger(config.window_minutes)) {
    return {
      type: 'rate_limit',
      outcome: 'satisfied',
      detail: 'rate_limit misconfigured — skipped',
      on_violation: onExceed,
    };
  }
  if (config.action_types && !config.action_types.includes(context.operation)) {
    return {
      type: 'rate_limit',
      outcome: 'satisfied',
      detail: 'operation not in rate_limit scope',
      on_violation: onExceed,
    };
  }

  const since = new Date(Date.now() - config.window_minutes * 60_000);
  const recentCount = await prisma.auditTrace.count({
    where: {
      tenant_id: context.tenant_id,
      agent_id: context.agent_id,
      requested_operation: context.operation,
      started_at: { gte: since },
    },
  });

  if (recentCount >= config.max_actions) {
    return {
      type: 'rate_limit',
      outcome: 'violated',
      detail: `${recentCount}/${config.max_actions} in last ${config.window_minutes}m`,
      on_violation: onExceed,
    };
  }
  return {
    type: 'rate_limit',
    outcome: 'satisfied',
    detail: `${recentCount + 1}/${config.max_actions} in last ${config.window_minutes}m`,
    on_violation: onExceed,
  };
}

function checkTimeRestriction(
  config: TimeRestrictionConfig,
  context: ConditionContext,
): ConditionResult {
  const onViolation = config.on_violation ?? 'deny';
  if (config.action_types && !config.action_types.includes(context.operation)) {
    return {
      type: 'time_restriction',
      outcome: 'satisfied',
      detail: 'operation not in time_restriction scope',
      on_violation: onViolation,
    };
  }

  const now = new Date();
  const tz = config.timezone ?? 'UTC';
  let localHour = now.getUTCHours();
  let localDay = now.getUTCDay(); // 0 = Sunday

  // Use Intl API for timezone-aware hour/day extraction
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      weekday: 'long',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour');
    const dayPart = parts.find((p) => p.type === 'weekday');
    if (hourPart) localHour = parseInt(hourPart.value, 10);
    if (dayPart) {
      const map: Record<string, number> = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
      };
      localDay = map[dayPart.value] ?? localDay;
    }
  } catch {
    // Invalid timezone — fall through with UTC values
  }

  if (config.blocked_hours && config.blocked_hours.includes(localHour)) {
    return {
      type: 'time_restriction',
      outcome: 'violated',
      detail: `hour ${localHour} is blocked (tz=${tz})`,
      on_violation: onViolation,
    };
  }
  if (config.blocked_days) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const currentDay = dayNames[localDay] ?? 'sunday';
    if (config.blocked_days.map((d) => d.toLowerCase()).includes(currentDay)) {
      return {
        type: 'time_restriction',
        outcome: 'violated',
        detail: `day ${currentDay} is blocked (tz=${tz})`,
        on_violation: onViolation,
      };
    }
  }
  return {
    type: 'time_restriction',
    outcome: 'satisfied',
    detail: `${localHour}:00 ${tz}`,
    on_violation: onViolation,
  };
}

async function checkCostThreshold(
  prisma: PrismaClient,
  config: CostThresholdConfig,
  context: ConditionContext,
  actionMetadata?: Record<string, unknown>,
): Promise<ConditionResult> {
  const onExceed = config.on_exceed ?? 'approval_required';
  const perActionEstimate = typeof actionMetadata?.estimated_cost === 'number'
    ? (actionMetadata.estimated_cost as number)
    : null;

  if (config.max_cost_per_action !== undefined && perActionEstimate !== null) {
    if (perActionEstimate > config.max_cost_per_action) {
      return {
        type: 'cost_threshold',
        outcome: 'violated',
        detail: `estimated ${perActionEstimate} > max_cost_per_action ${config.max_cost_per_action}`,
        on_violation: onExceed,
      };
    }
  }

  if (config.max_cost_per_hour !== undefined) {
    const since = new Date(Date.now() - 60 * 60_000);
    // cost_estimate was added to AuditTrace in migration 20260416120000
    const traces = await prisma.auditTrace.findMany({
      where: {
        tenant_id: context.tenant_id,
        agent_id: context.agent_id,
        started_at: { gte: since },
        cost_estimate: { not: null },
      },
      select: { cost_estimate: true },
    });
    const hourlyCost = traces.reduce(
      (sum, t) => sum + (t.cost_estimate ? Number(t.cost_estimate) : 0),
      0,
    );
    if (hourlyCost >= config.max_cost_per_hour) {
      return {
        type: 'cost_threshold',
        outcome: 'violated',
        detail: `hourly spend ${hourlyCost.toFixed(4)} >= max ${config.max_cost_per_hour}`,
        on_violation: onExceed,
      };
    }
  }
  return {
    type: 'cost_threshold',
    outcome: 'satisfied',
    detail: 'within cost thresholds',
    on_violation: onExceed,
  };
}

async function checkWebhook(
  config: WebhookCheckConfig,
  context: ConditionContext,
  actionMetadata?: Record<string, unknown>,
): Promise<ConditionResult> {
  const onTimeout = config.on_timeout ?? 'deny';
  if (!config.url) {
    return {
      type: 'webhook_check',
      outcome: 'satisfied',
      detail: 'webhook_check misconfigured — skipped',
      on_violation: onTimeout,
    };
  }

  // SSRF guard + TOCTOU-safe fetch — safeFetch validates the URL, pins the
  // resolved IP to the socket dial, and fails on 3xx redirects. Any of these
  // conditions throws UrlSafetyError which we fail-closed on.
  const timeoutMs = config.timeout_ms ?? 2000;
  try {
    const resp = await safeFetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: context.tenant_id,
        agent_id: context.agent_id,
        operation: context.operation,
        target_integration: context.target_integration,
        metadata: actionMetadata ?? {},
      }),
      timeoutMs,
      validateOptions: { allowHttpInDev: true },
    });
    if (!resp.ok) {
      return {
        type: 'webhook_check',
        outcome: 'violated',
        detail: `webhook returned HTTP ${resp.status}`,
        on_violation: onTimeout,
      };
    }
    let body: unknown = null;
    try {
      body = await resp.json();
    } catch {
      body = null;
    }
    if (body && typeof body === 'object' && 'allowed' in body && (body as { allowed: unknown }).allowed === false) {
      const reasonField = (body as Record<string, unknown>).reason;
      return {
        type: 'webhook_check',
        outcome: 'violated',
        detail: typeof reasonField === 'string' ? reasonField : 'webhook disallowed the action',
        on_violation: onTimeout,
      };
    }
    return {
      type: 'webhook_check',
      outcome: 'satisfied',
      detail: 'webhook allowed action',
      on_violation: onTimeout,
    };
  } catch (err) {
    // SSRF violations, redirects to private, network failure, timeout,
    // or abort — all fail-closed by default.
    if (err instanceof UrlSafetyError) {
      return {
        type: 'webhook_check',
        outcome: 'violated',
        detail: `webhook_check blocked: ${err.reason} (${err.message})`,
        on_violation: onTimeout,
      };
    }
    return {
      type: 'webhook_check',
      outcome: 'violated',
      detail: `webhook error: ${err instanceof Error ? err.message : String(err)}`,
      on_violation: onTimeout,
    };
  }
}
