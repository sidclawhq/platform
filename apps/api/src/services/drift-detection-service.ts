/**
 * Behavioral drift detection — statistical anomaly checks over AuditTrace.
 *
 * Runs per-agent and emits `agent.drift_detected` webhook events when an
 * agent's recent behavior deviates from its historical pattern. Lightweight
 * by design: no pgvector, no ML — just counts and thresholds over rows
 * that already exist in AuditTrace. This covers the "how do I know the
 * agent went rogue" question most enterprise buyers ask without adding
 * new infrastructure.
 *
 * Added 2026-04-16 as part of the competitive-response initiative.
 */

import type { PrismaClient } from '../generated/prisma/index.js';

export type DriftTriggerType =
  | 'risk_spike'
  | 'novel_action'
  | 'frequency_spike'
  | 'cost_spike';

export interface DriftSignal {
  tenant_id: string;
  agent_id: string;
  trigger: DriftTriggerType;
  severity: 'low' | 'medium' | 'high';
  detail: string;
  recent_window_minutes: number;
  historical_window_hours: number;
  metrics: Record<string, number | string>;
}

export interface DriftDetectionOptions {
  recent_window_minutes?: number;       // default 60
  // Default baseline is 7 days — smooths weekday/weekend seasonality and
  // prevents `novel_action` from firing on every operation an agent tried
  // in its first day of adoption.
  historical_window_hours?: number;     // default 168 (7 days)
  min_historical_actions?: number;      // default 50 (baseline stability)
  risk_spike_threshold?: number;        // default 1.5 (50% jump)
  frequency_spike_threshold?: number;   // default 3.0 (3× baseline)
  cost_spike_threshold?: number;        // default 3.0
  // Don't re-alert on the same (agent, trigger, signature) within this
  // many minutes — prevents hourly-job signal spam.
  dedup_window_minutes?: number;        // default 1440 (24h)
}

const DEFAULTS: Required<DriftDetectionOptions> = {
  recent_window_minutes: 60,
  historical_window_hours: 168,
  min_historical_actions: 50,
  risk_spike_threshold: 1.5,
  frequency_spike_threshold: 3.0,
  cost_spike_threshold: 3.0,
  dedup_window_minutes: 1440,
};

export class DriftDetectionService {
  private readonly opts: Required<DriftDetectionOptions>;

  constructor(
    private readonly prisma: PrismaClient,
    options: DriftDetectionOptions = {},
  ) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /**
   * For a given agent, return the set of (trigger, signature) pairs we have
   * already alerted on within the dedup window. Signals matching a recent
   * alert are suppressed. This uses AuditEvent as storage — no new table.
   */
  private async recentAlertSignatures(
    tenantId: string,
    agentId: string,
  ): Promise<Set<string>> {
    const since = new Date(
      Date.now() - this.opts.dedup_window_minutes * 60_000,
    );
    const events = await this.prisma.auditEvent.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: agentId,
        event_type: 'drift_detected',
        timestamp: { gte: since },
      },
      select: { metadata: true },
    });
    const sigs = new Set<string>();
    for (const e of events) {
      const m = e.metadata as Record<string, unknown> | null;
      const sig = m?.signature;
      if (typeof sig === 'string') sigs.add(sig);
    }
    return sigs;
  }

  /**
   * Record a drift signal as an AuditEvent (for dedup) without requiring a
   * parent AuditTrace. Stored with a `null` trace_id equivalent isn't
   * allowed by the schema, so we write against a synthetic "drift" trace
   * created lazily per agent.
   */
  private async persistSignal(
    tenantId: string,
    signal: DriftSignal,
    signature: string,
  ): Promise<void> {
    // Find-or-create a sentinel trace per agent to hold drift events.
    // The find+create is wrapped in a transaction with a serialized insert
    // path so two concurrent hourly runs on the same agent produce exactly
    // one sentinel. (The partial unique index in migration 20260417120000
    // enforces this at the DB level as a final defense.)
    const trace = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.auditTrace.findFirst({
        where: {
          tenant_id: tenantId,
          agent_id: signal.agent_id,
          final_outcome: 'drift_sentinel',
        },
      });
      if (existing) return existing;
      try {
        return await tx.auditTrace.create({
          data: {
            tenant_id: tenantId,
            agent_id: signal.agent_id,
            authority_model: 'self',
            requested_operation: 'drift_sentinel',
            target_integration: 'sidclaw_internal',
            resource_scope: 'agent.drift',
            final_outcome: 'drift_sentinel',
          },
        });
      } catch (e) {
        // Unique-violation race: another writer inserted the sentinel
        // between our findFirst and create. Re-read and use theirs.
        const retry = await tx.auditTrace.findFirst({
          where: {
            tenant_id: tenantId,
            agent_id: signal.agent_id,
            final_outcome: 'drift_sentinel',
          },
        });
        if (retry) return retry;
        throw e;
      }
    });

    await this.prisma.auditEvent.create({
      data: {
        tenant_id: tenantId,
        trace_id: trace.id,
        agent_id: signal.agent_id,
        event_type: 'drift_detected',
        actor_type: 'system',
        actor_name: 'Drift Detection Service',
        description: `${signal.trigger} (${signal.severity}): ${signal.detail}`,
        status: 'detected',
        metadata: {
          signature,
          trigger: signal.trigger,
          severity: signal.severity,
          detail: signal.detail,
          metrics: signal.metrics,
        } as object,
      },
    });
  }

  /**
   * Run all detectors for a single agent. Returns the drift signals found;
   * caller is responsible for dispatching webhooks. Signals already alerted
   * within the dedup window are suppressed.
   */
  async detectForAgent(tenantId: string, agentId: string): Promise<DriftSignal[]> {
    const now = Date.now();
    const recentStart = new Date(now - this.opts.recent_window_minutes * 60_000);
    const historicalStart = new Date(
      now - this.opts.historical_window_hours * 3_600_000,
    );
    const historicalEnd = recentStart;

    const [recent, historical] = await Promise.all([
      this.prisma.auditTrace.findMany({
        where: {
          tenant_id: tenantId,
          agent_id: agentId,
          started_at: { gte: recentStart },
          deleted_at: null,
        },
        select: {
          requested_operation: true,
          cost_estimate: true,
          final_outcome: true,
        },
      }),
      this.prisma.auditTrace.findMany({
        where: {
          tenant_id: tenantId,
          agent_id: agentId,
          started_at: { gte: historicalStart, lt: historicalEnd },
          deleted_at: null,
        },
        select: {
          requested_operation: true,
          cost_estimate: true,
          final_outcome: true,
        },
      }),
    ]);

    const signals: DriftSignal[] = [];
    if (historical.length < this.opts.min_historical_actions) {
      // Not enough history to baseline — skip drift checks.
      return signals;
    }

    // 1. Frequency spike
    const recentRate = recent.length / this.opts.recent_window_minutes;
    const historicalRate = historical.length / (this.opts.historical_window_hours * 60);
    if (historicalRate > 0 && recentRate / historicalRate >= this.opts.frequency_spike_threshold) {
      signals.push({
        tenant_id: tenantId,
        agent_id: agentId,
        trigger: 'frequency_spike',
        severity: recentRate / historicalRate >= 5 ? 'high' : 'medium',
        detail: `Action rate ${recentRate.toFixed(2)}/min vs baseline ${historicalRate.toFixed(2)}/min`,
        recent_window_minutes: this.opts.recent_window_minutes,
        historical_window_hours: this.opts.historical_window_hours,
        metrics: {
          recent_actions: recent.length,
          historical_actions: historical.length,
          recent_rate_per_min: Number(recentRate.toFixed(4)),
          historical_rate_per_min: Number(historicalRate.toFixed(4)),
          multiplier: Number((recentRate / historicalRate).toFixed(2)),
        },
      });
    }

    // 2. Novel action
    const historicalOps = new Set(historical.map((t) => t.requested_operation));
    const novelOps: string[] = [];
    for (const t of recent) {
      if (!historicalOps.has(t.requested_operation) && !novelOps.includes(t.requested_operation)) {
        novelOps.push(t.requested_operation);
      }
    }
    if (novelOps.length > 0) {
      signals.push({
        tenant_id: tenantId,
        agent_id: agentId,
        trigger: 'novel_action',
        severity: novelOps.length >= 3 ? 'high' : 'medium',
        detail: `Agent performed ${novelOps.length} operation(s) never seen in the last ${this.opts.historical_window_hours}h: ${novelOps.slice(0, 5).join(', ')}`,
        recent_window_minutes: this.opts.recent_window_minutes,
        historical_window_hours: this.opts.historical_window_hours,
        metrics: {
          novel_operations: novelOps.slice(0, 10).join(','),
          novel_count: novelOps.length,
        },
      });
    }

    // 3. Risk spike — proxy by ratio of non-allowed outcomes
    // (block / deny / expired are all "risky" outcomes in the platform's taxonomy)
    const historicalBlocked = historical.filter((t) =>
      ['blocked', 'denied', 'expired'].includes(t.final_outcome),
    ).length;
    const recentBlocked = recent.filter((t) =>
      ['blocked', 'denied', 'expired'].includes(t.final_outcome),
    ).length;
    const historicalBlockRate = historical.length ? historicalBlocked / historical.length : 0;
    const recentBlockRate = recent.length ? recentBlocked / recent.length : 0;
    if (
      recent.length >= 5 &&
      historicalBlockRate > 0.05 && // only flag if baseline is non-trivial
      recentBlockRate / historicalBlockRate >= this.opts.risk_spike_threshold
    ) {
      signals.push({
        tenant_id: tenantId,
        agent_id: agentId,
        trigger: 'risk_spike',
        severity: recentBlockRate >= 0.5 ? 'high' : 'medium',
        detail: `Block/deny rate ${(recentBlockRate * 100).toFixed(1)}% vs baseline ${(historicalBlockRate * 100).toFixed(1)}%`,
        recent_window_minutes: this.opts.recent_window_minutes,
        historical_window_hours: this.opts.historical_window_hours,
        metrics: {
          recent_block_rate: Number(recentBlockRate.toFixed(4)),
          historical_block_rate: Number(historicalBlockRate.toFixed(4)),
          recent_blocked: recentBlocked,
          historical_blocked: historicalBlocked,
        },
      });
    }

    // 4. Cost spike
    const historicalCost = historical.reduce(
      (sum, t) => sum + (t.cost_estimate ? Number(t.cost_estimate) : 0),
      0,
    );
    const recentCost = recent.reduce(
      (sum, t) => sum + (t.cost_estimate ? Number(t.cost_estimate) : 0),
      0,
    );
    const recentCostRate = recentCost / this.opts.recent_window_minutes;
    const historicalCostRate = historicalCost / (this.opts.historical_window_hours * 60);
    if (
      historicalCostRate > 0 &&
      recentCostRate / historicalCostRate >= this.opts.cost_spike_threshold
    ) {
      signals.push({
        tenant_id: tenantId,
        agent_id: agentId,
        trigger: 'cost_spike',
        severity: recentCostRate / historicalCostRate >= 10 ? 'high' : 'medium',
        detail: `LLM cost rate ${recentCostRate.toFixed(5)}/min vs baseline ${historicalCostRate.toFixed(5)}/min`,
        recent_window_minutes: this.opts.recent_window_minutes,
        historical_window_hours: this.opts.historical_window_hours,
        metrics: {
          recent_cost_usd: Number(recentCost.toFixed(6)),
          historical_cost_usd: Number(historicalCost.toFixed(6)),
          multiplier: Number((recentCostRate / historicalCostRate).toFixed(2)),
        },
      });
    }

    // Dedup: drop any signal whose (trigger, signature) was already recorded
    // within the dedup window. Use a stable signature per trigger type.
    const alreadyAlerted = await this.recentAlertSignatures(tenantId, agentId);
    const fresh: DriftSignal[] = [];
    for (const signal of signals) {
      const signature = this.signatureFor(signal);
      if (alreadyAlerted.has(signature)) continue;
      try {
        await this.persistSignal(tenantId, signal, signature);
      } catch {
        // Never let dedup-persistence failure swallow the actual signal
      }
      fresh.push(signal);
    }
    return fresh;
  }

  private signatureFor(signal: DriftSignal): string {
    // Keep signatures stable across runs so dedup works. For novel_action,
    // include the offending operations; for other triggers we intentionally
    // drop severity so medium↔high oscillation within the dedup window
    // doesn't re-alert.
    if (signal.trigger === 'novel_action') {
      const ops = String(signal.metrics.novel_operations ?? '').split(',').sort();
      return `novel_action:${ops.join('|')}`;
    }
    return signal.trigger;
  }

  /**
   * Run drift detection for all active agents in a tenant. Returns all signals.
   */
  async detectForTenant(tenantId: string): Promise<DriftSignal[]> {
    const agents = await this.prisma.agent.findMany({
      where: { tenant_id: tenantId, lifecycle_state: 'active' },
      select: { id: true },
    });
    const allSignals: DriftSignal[] = [];
    for (const a of agents) {
      const signals = await this.detectForAgent(tenantId, a.id);
      allSignals.push(...signals);
    }
    return allSignals;
  }
}
