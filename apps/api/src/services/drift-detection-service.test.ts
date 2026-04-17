import { describe, it, expect, vi } from 'vitest';
import { DriftDetectionService } from './drift-detection-service.js';

function buildPrisma(
  recent: Array<any>,
  historical: Array<any>,
  agents: Array<any> = [],
  priorDriftEvents: Array<{ metadata: Record<string, unknown> }> = [],
) {
  return {
    auditTrace: {
      findMany: vi.fn(async (args: any) => {
        // Distinguish recent vs historical by the gte/lt range — historical
        // query uses { gte, lt }, recent uses { gte }.
        const where = args.where;
        if (where.started_at?.lt) return historical;
        return recent;
      }),
      findFirst: vi.fn(async () => null), // sentinel trace lookup — always create new
      create: vi.fn(async (args: any) => ({ id: 'sentinel-trace', ...args.data })),
    },
    auditEvent: {
      findMany: vi.fn(async () => priorDriftEvents),
      create: vi.fn(async () => ({})),
    },
    agent: {
      findMany: vi.fn(async () => agents),
    },
  } as any;
}

describe('DriftDetectionService', () => {
  it('returns no signals with insufficient history', async () => {
    const prisma = buildPrisma([], []);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    expect(signals).toEqual([]);
  });

  it('detects frequency spike', async () => {
    const recent = Array(30).fill(0).map((_, i) => ({
      requested_operation: 'send_email',
      cost_estimate: 0,
      final_outcome: 'executed',
    }));
    const historical = Array(50).fill(0).map(() => ({
      requested_operation: 'send_email',
      cost_estimate: 0,
      final_outcome: 'executed',
    }));
    const prisma = buildPrisma(recent, historical);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    const freq = signals.find((s) => s.trigger === 'frequency_spike');
    expect(freq).toBeDefined();
    expect(freq!.severity).toMatch(/high|medium/);
  });

  it('detects novel action', async () => {
    const recent = [
      { requested_operation: 'new_operation', cost_estimate: 0, final_outcome: 'executed' },
      { requested_operation: 'send_email', cost_estimate: 0, final_outcome: 'executed' },
    ];
    const historical = Array(20).fill(0).map(() => ({
      requested_operation: 'send_email',
      cost_estimate: 0,
      final_outcome: 'executed',
    }));
    const prisma = buildPrisma(recent, historical);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    const novel = signals.find((s) => s.trigger === 'novel_action');
    expect(novel).toBeDefined();
    expect(novel!.detail).toContain('new_operation');
  });

  it('detects risk spike when blocked rate jumps', async () => {
    const recent = [
      ...Array(5).fill({ requested_operation: 'op', cost_estimate: 0, final_outcome: 'blocked' }),
      ...Array(5).fill({ requested_operation: 'op', cost_estimate: 0, final_outcome: 'executed' }),
    ];
    const historical = [
      ...Array(2).fill({ requested_operation: 'op', cost_estimate: 0, final_outcome: 'blocked' }),
      ...Array(18).fill({ requested_operation: 'op', cost_estimate: 0, final_outcome: 'executed' }),
    ];
    const prisma = buildPrisma(recent, historical);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    const risk = signals.find((s) => s.trigger === 'risk_spike');
    expect(risk).toBeDefined();
  });

  it('detects cost spike', async () => {
    const recent = Array(5)
      .fill(0)
      .map(() => ({ requested_operation: 'op', cost_estimate: 1.0, final_outcome: 'executed' }));
    const historical = Array(50)
      .fill(0)
      .map(() => ({ requested_operation: 'op', cost_estimate: 0.01, final_outcome: 'executed' }));
    const prisma = buildPrisma(recent, historical);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    const cost = signals.find((s) => s.trigger === 'cost_spike');
    expect(cost).toBeDefined();
    expect(cost!.metrics.multiplier as number).toBeGreaterThan(3);
  });

  it('detectForTenant iterates agents', async () => {
    const prisma = buildPrisma([], [], [{ id: 'a1' }, { id: 'a2' }]);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForTenant('t1');
    expect(prisma.agent.findMany).toHaveBeenCalled();
    expect(signals).toEqual([]);
  });

  it('dedupes novel_action signals across runs via AuditEvent history', async () => {
    const recent = [
      { requested_operation: 'new_operation', cost_estimate: 0, final_outcome: 'executed' },
    ];
    const historical = Array(20).fill(0).map(() => ({
      requested_operation: 'send_email',
      cost_estimate: 0,
      final_outcome: 'executed',
    }));
    // Prior drift event with matching signature — should suppress this run.
    const priorDrift = [
      { metadata: { signature: 'novel_action:new_operation' } },
    ];
    const prisma = buildPrisma(recent, historical, [], priorDrift);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    expect(signals.find((s) => s.trigger === 'novel_action')).toBeUndefined();
  });

  it('skips when recent block rate does not exceed threshold', async () => {
    const recent = Array(10).fill({
      requested_operation: 'op',
      cost_estimate: 0,
      final_outcome: 'executed',
    });
    const historical = Array(20).fill({
      requested_operation: 'op',
      cost_estimate: 0,
      final_outcome: 'executed',
    });
    const prisma = buildPrisma(recent, historical);
    const service = new DriftDetectionService(prisma, { min_historical_actions: 10 });
    const signals = await service.detectForAgent('t1', 'a1');
    expect(signals.find((s) => s.trigger === 'risk_spike')).toBeUndefined();
  });
});
