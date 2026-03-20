"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Agent, PolicyRule, ApprovalRequest, AuditTrace, AuditEvent,
  ApprovalStatus, TraceOutcome, EventType, ActorType, LifecycleState
} from '@/lib/types';
import { SEED_AGENTS, SEED_POLICIES, SEED_APPROVALS, SEED_TRACES, SEED_EVENTS } from '@/lib/fixtures';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AppState {
  agents: Agent[];
  policyRules: PolicyRule[];
  approvalRequests: ApprovalRequest[];
  auditTraces: AuditTrace[];
  auditEvents: AuditEvent[];
}

interface AppContextValue extends AppState {
  approveRequest: (id: string, note?: string) => void;
  denyRequest: (id: string, note?: string) => void;
  suspendAgent: (id: string) => void;
  revokeAgent: (id: string) => void;
  resetScenarios: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitialState(): AppState {
  return {
    agents: structuredClone(SEED_AGENTS),
    policyRules: structuredClone(SEED_POLICIES),
    approvalRequests: structuredClone(SEED_APPROVALS),
    auditTraces: structuredClone(SEED_TRACES),
    auditEvents: structuredClone(SEED_EVENTS),
  };
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const AppContext = createContext<AppContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(getInitialState);

  /* ---- approveRequest ------------------------------------------- */
  const approveRequest = useCallback((id: string, note?: string) => {
    setState((prev) => {
      const request = prev.approvalRequests.find((r) => r.id === id);
      if (!request) return prev;

      const trace = prev.auditTraces.find((t) => t.trace_id === request.trace_id);
      const now = Date.now();

      // Update the approval request
      const updatedRequests = prev.approvalRequests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'approved' as ApprovalStatus,
              decided_at: new Date().toISOString(),
              approver_name: 'Security Reviewer',
              decision_note: note || null,
            }
          : r,
      );

      // Build the three new audit events
      const baseEvent = {
        trace_id: request.trace_id,
        agent_id: request.agent_id,
        policy_version: null,
        correlation_id: null,
      };

      const newEvents: AuditEvent[] = [
        {
          ...baseEvent,
          id: `evt-${now}-1`,
          timestamp: new Date(now).toISOString(),
          event_type: 'approval_granted' as EventType,
          actor_type: 'human_reviewer' as ActorType,
          actor_name: 'Security Reviewer',
          description:
            'Reviewer approved the operation after policy-based review. Decision recorded in trace.',
          status: 'completed',
          approval_request_id: id,
        },
        {
          ...baseEvent,
          id: `evt-${now}-2`,
          timestamp: new Date(now + 1000).toISOString(),
          event_type: 'operation_executed' as EventType,
          actor_type: 'system' as ActorType,
          actor_name: 'Execution Service',
          description:
            'Operation executed following approval. Outbound action completed within authorized scope.',
          status: 'completed',
          approval_request_id: null,
        },
        {
          ...baseEvent,
          id: `evt-${now}-3`,
          timestamp: new Date(now + 2000).toISOString(),
          event_type: 'trace_closed' as EventType,
          actor_type: 'system' as ActorType,
          actor_name: 'Trace Service',
          description:
            'Trace closed. Final outcome: completed with approval.',
          status: 'completed',
          approval_request_id: null,
        },
      ];

      // Update the audit trace
      const updatedTraces = trace
        ? prev.auditTraces.map((t) =>
            t.trace_id === request.trace_id
              ? {
                  ...t,
                  final_outcome: 'completed_with_approval' as TraceOutcome,
                  completed_at: new Date().toISOString(),
                }
              : t,
          )
        : prev.auditTraces;

      return {
        ...prev,
        approvalRequests: updatedRequests,
        auditEvents: [...prev.auditEvents, ...newEvents],
        auditTraces: updatedTraces,
      };
    });
  }, []);

  /* ---- denyRequest ---------------------------------------------- */
  const denyRequest = useCallback((id: string, note?: string) => {
    setState((prev) => {
      const request = prev.approvalRequests.find((r) => r.id === id);
      if (!request) return prev;

      const trace = prev.auditTraces.find((t) => t.trace_id === request.trace_id);
      const now = Date.now();

      // Update the approval request
      const updatedRequests = prev.approvalRequests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'denied' as ApprovalStatus,
              decided_at: new Date().toISOString(),
              approver_name: 'Security Reviewer',
              decision_note: note || null,
            }
          : r,
      );

      // Build the three new audit events
      const baseEvent = {
        trace_id: request.trace_id,
        agent_id: request.agent_id,
        policy_version: null,
        correlation_id: null,
      };

      const newEvents: AuditEvent[] = [
        {
          ...baseEvent,
          id: `evt-${now}-1`,
          timestamp: new Date(now).toISOString(),
          event_type: 'approval_denied' as EventType,
          actor_type: 'human_reviewer' as ActorType,
          actor_name: 'Security Reviewer',
          description:
            'Reviewer denied the operation. Policy-based review resulted in rejection.',
          status: 'completed',
          approval_request_id: id,
        },
        {
          ...baseEvent,
          id: `evt-${now}-2`,
          timestamp: new Date(now + 1000).toISOString(),
          event_type: 'operation_blocked' as EventType,
          actor_type: 'system' as ActorType,
          actor_name: 'Execution Service',
          description:
            'Operation blocked following denial. No outbound action was performed.',
          status: 'completed',
          approval_request_id: null,
        },
        {
          ...baseEvent,
          id: `evt-${now}-3`,
          timestamp: new Date(now + 2000).toISOString(),
          event_type: 'trace_closed' as EventType,
          actor_type: 'system' as ActorType,
          actor_name: 'Trace Service',
          description: 'Trace closed. Final outcome: denied.',
          status: 'completed',
          approval_request_id: null,
        },
      ];

      // Update the audit trace
      const updatedTraces = trace
        ? prev.auditTraces.map((t) =>
            t.trace_id === request.trace_id
              ? {
                  ...t,
                  final_outcome: 'denied' as TraceOutcome,
                  completed_at: new Date().toISOString(),
                }
              : t,
          )
        : prev.auditTraces;

      return {
        ...prev,
        approvalRequests: updatedRequests,
        auditEvents: [...prev.auditEvents, ...newEvents],
        auditTraces: updatedTraces,
      };
    });
  }, []);

  /* ---- suspendAgent --------------------------------------------- */
  const suspendAgent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((a) =>
        a.id === id
          ? { ...a, lifecycle_state: 'suspended' as LifecycleState }
          : a,
      ),
    }));
  }, []);

  /* ---- revokeAgent ---------------------------------------------- */
  const revokeAgent = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      agents: prev.agents.map((a) =>
        a.id === id
          ? { ...a, lifecycle_state: 'revoked' as LifecycleState }
          : a,
      ),
    }));
  }, []);

  /* ---- resetScenarios ------------------------------------------- */
  const resetScenarios = useCallback(() => {
    setState(getInitialState());
  }, []);

  /* ---- value ---------------------------------------------------- */
  const value: AppContextValue = {
    ...state,
    approveRequest,
    denyRequest,
    suspendAgent,
    revokeAgent,
    resetScenarios,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an <AppProvider>');
  }
  return ctx;
}
