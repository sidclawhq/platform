import { createHash } from 'crypto';
import type { PrismaClient } from '../generated/prisma/index.js';

interface EventHashData {
  id: string;
  event_type: string;
  actor_type: string;
  actor_name: string;
  description: string;
  status: string;
  timestamp: Date;
}

export class IntegrityService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Computes the integrity hash for a new audit event.
   * The hash chain links each event to its predecessor within the same trace.
   *
   * MUST be called within a transaction that holds a lock on the trace row
   * to prevent concurrent events from breaking the chain.
   *
   * @param knownPreviousHash - If provided, used as the previous hash directly
   *   instead of querying the DB. Use this when creating multiple events in
   *   the same transaction to avoid timestamp-ordering ambiguity.
   */
  async computeEventHash(
    tx: PrismaClient,
    traceId: string,
    eventData: EventHashData,
    knownPreviousHash?: string | null,
  ): Promise<string> {
    let previousHash: string | null;

    if (knownPreviousHash !== undefined) {
      previousHash = knownPreviousHash;
    } else {
      // Get the previous event's hash (the latest event in this trace).
      // Order by (timestamp DESC, id DESC) so two events with identical
      // sub-ms timestamps produce a deterministic ordering. Without the
      // id tiebreaker, Postgres is free to return either row first, which
      // would make the chain non-deterministic under concurrent writes.
      const previousEvent = await (tx as PrismaClient).auditEvent.findFirst({
        where: { trace_id: traceId, integrity_hash: { not: null } },
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        select: { integrity_hash: true },
      });
      previousHash = previousEvent?.integrity_hash ?? null;
    }

    return this.computeHashSync(
      { ...eventData, trace_id: traceId },
      previousHash,
    );
  }

  /**
   * Verifies the integrity of a trace's event chain.
   */
  async verifyTrace(traceId: string, tenantId: string): Promise<{
    verified: boolean;
    total_events: number;
    verified_events: number;
    broken_at: {
      event_id: string;
      event_type: string;
      expected_hash: string;
      actual_hash: string;
    } | null;
  }> {
    const events = await this.prisma.auditEvent.findMany({
      where: { trace_id: traceId, tenant_id: tenantId },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        trace_id: true,
        event_type: true,
        actor_type: true,
        actor_name: true,
        description: true,
        status: true,
        timestamp: true,
        integrity_hash: true,
      },
    });

    if (events.length === 0) {
      return { verified: true, total_events: 0, verified_events: 0, broken_at: null };
    }

    let previousHash: string | null = null;
    let verifiedCount = 0;

    for (const event of events) {
      // Skip events without hashes (created before this feature)
      if (!event.integrity_hash) {
        previousHash = null; // break the chain reference
        continue;
      }

      const expectedHash = this.computeHashSync(event, previousHash);

      if (event.integrity_hash !== expectedHash) {
        return {
          verified: false,
          total_events: events.length,
          verified_events: verifiedCount,
          broken_at: {
            event_id: event.id,
            event_type: event.event_type,
            expected_hash: expectedHash,
            actual_hash: event.integrity_hash,
          },
        };
      }

      previousHash = event.integrity_hash;
      verifiedCount++;
    }

    return {
      verified: true,
      total_events: events.length,
      verified_events: verifiedCount,
      broken_at: null,
    };
  }

  computeHashSync(
    event: {
      id: string;
      trace_id: string;
      event_type: string;
      actor_type: string;
      actor_name: string;
      description: string;
      status: string;
      timestamp: Date;
    },
    previousHash: string | null,
  ): string {
    const payload = JSON.stringify({
      id: event.id,
      trace_id: event.trace_id,
      event_type: event.event_type,
      actor_type: event.actor_type,
      actor_name: event.actor_name,
      description: event.description,
      status: event.status,
      timestamp: event.timestamp.toISOString(),
      previous_hash: previousHash ?? 'GENESIS',
    });
    return createHash('sha256').update(payload).digest('hex');
  }
}
