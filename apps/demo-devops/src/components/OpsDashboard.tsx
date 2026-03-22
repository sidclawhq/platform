'use client';

import { useState, useEffect, useCallback } from 'react';
import { SERVICES, LOGS, PENDING_DEPLOY } from '@/lib/demo-tools';
import { ServiceList } from './ServiceList';
import { ServiceCard } from './ServiceCard';
import { LogViewer } from './LogViewer';
import { AgentRecommendations } from './AgentRecommendations';
import { DangerZone } from './DangerZone';
import { ActivityLog } from './ActivityLog';
import type { ActivityEntry } from './ActivityLog';

interface OpsDashboardProps {
  agentId: string;
  apiKey: string;
}

interface ActionState {
  status: 'idle' | 'loading' | 'awaiting' | 'done' | 'blocked';
  approvalRequestId?: string;
}

const ACTION_CONFIGS: Record<string, { operation: string; target_integration: string; resource_scope: string; data_classification: string; context: Record<string, unknown> }> = {
  scale: {
    operation: 'scale_service',
    target_integration: 'container_orchestrator',
    resource_scope: 'service_replicas',
    data_classification: 'confidential',
    context: { service: 'user-service', current_replicas: 3, target_replicas: 6, reason: 'Memory pressure — approaching OOM threshold' },
  },
  'deploy-prod': {
    operation: 'deploy_to_production',
    target_integration: 'deployment_pipeline',
    resource_scope: 'production_environment',
    data_classification: 'confidential',
    context: {
      service: 'user-service',
      current_version: 'v1.8.7',
      new_version: 'v1.8.8',
      changes: PENDING_DEPLOY.changes,
      ci_status: 'passed',
      tests: '142/142 passed',
      rollback_plan: PENDING_DEPLOY.rollbackPlan,
    },
  },
  'deploy-staging': {
    operation: 'deploy_to_staging',
    target_integration: 'deployment_pipeline',
    resource_scope: 'staging_environment',
    data_classification: 'confidential',
    context: { service: 'user-service', version: 'v1.8.8', environment: 'staging' },
  },
  'delete-namespace': {
    operation: 'delete_namespace',
    target_integration: 'container_orchestrator',
    resource_scope: 'kubernetes_namespaces',
    data_classification: 'restricted',
    context: { namespace: 'load-test-march', services: 6, pods: 30 },
  },
  'rotate-secrets': {
    operation: 'rotate_secrets',
    target_integration: 'secrets_manager',
    resource_scope: 'production_credentials',
    data_classification: 'restricted',
    context: { service: 'payment-processor', scope: 'all_credentials' },
  },
};

const INITIAL_ACTIVITY: ActivityEntry[] = [
  { time: '08:14:24', icon: '✓', message: 'Health check: api-gateway → healthy (34% CPU, 0.02% errors)', type: 'success' },
  { time: '08:14:24', icon: '✓', message: 'Health check: payment-processor → healthy (22% CPU, 0.001% errors)', type: 'success' },
  { time: '08:14:24', icon: '▲', message: 'Health check: user-service → DEGRADED (78% CPU, 89% memory, 1.4% errors)', type: 'warning' },
  { time: '08:14:25', icon: '→', message: 'Analysis: user-service memory leak detected. v1.8.8 available with fix.', type: 'action' },
  { time: '08:14:25', icon: '→', message: 'Recommendation: Scale to 6 replicas (immediate) + deploy v1.8.8 (permanent fix)', type: 'action' },
];

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function OpsDashboard({ agentId, apiKey }: OpsDashboardProps) {
  const [selectedService, setSelectedService] = useState('user-service');
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [activity, setActivity] = useState<ActivityEntry[]>(INITIAL_ACTIVITY);
  const [healthChecksRun, setHealthChecksRun] = useState(false);

  const addActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev]);
  }, []);

  // Auto-run health checks on page load
  useEffect(() => {
    if (!agentId || !apiKey || healthChecksRun) return;
    setHealthChecksRun(true);

    const runHealthChecks = async () => {
      for (const serviceId of Object.keys(SERVICES)) {
        await fetch('/api/agent-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            agentId,
            action: {
              operation: 'check_health',
              target_integration: 'infrastructure_monitor',
              resource_scope: 'service_metrics',
              data_classification: 'internal',
              context: { service: serviceId },
            },
          }),
        });
      }
    };

    runHealthChecks();
  }, [agentId, apiKey, healthChecksRun]);

  // Poll for approval resolution — when an awaiting action gets approved/denied, update button state
  useEffect(() => {
    const awaitingActions = Object.entries(actionStates).filter(
      ([, s]) => s.status === 'awaiting' && s.approvalRequestId
    );
    if (awaitingActions.length === 0) return;

    const checkApprovals = async () => {
      try {
        const res = await fetch(`/api/governance?agentId=${agentId}&apiKey=${apiKey}`);
        if (!res.ok) return;
        const data = await res.json();
        const pendingIds = new Set(
          (data.pendingApprovals ?? []).map((a: { id: string }) => a.id)
        );

        for (const [actionId, state] of awaitingActions) {
          if (state.approvalRequestId && !pendingIds.has(state.approvalRequestId)) {
            // Approval was resolved (no longer pending)
            setActionStates((prev) => ({ ...prev, [actionId]: { status: 'done' } }));
            const config = ACTION_CONFIGS[actionId];
            addActivity({
              time: nowTime(),
              icon: '✓',
              message: `Approved: ${config?.operation ?? actionId} completed successfully`,
              type: 'success',
            });
          }
        }
      } catch {
        // Silent fail
      }
    };

    const interval = setInterval(checkApprovals, 2000);
    return () => clearInterval(interval);
  }, [actionStates, agentId, apiKey, addActivity]);

  const handleAction = async (actionId: string) => {
    const config = ACTION_CONFIGS[actionId];
    if (!config) return;

    setActionStates((prev) => ({ ...prev, [actionId]: { status: 'loading' } }));

    try {
      const res = await fetch('/api/agent-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, agentId, action: config }),
      });

      const data = await res.json();

      if (data.decision === 'allow') {
        setActionStates((prev) => ({ ...prev, [actionId]: { status: 'done' } }));
        addActivity({ time: nowTime(), icon: '✓', message: `Allowed: ${config.operation} on ${config.target_integration}`, type: 'success' });
      } else if (data.decision === 'approval_required') {
        setActionStates((prev) => ({ ...prev, [actionId]: { status: 'awaiting', approvalRequestId: data.approval_request_id } }));
        addActivity({ time: nowTime(), icon: '⏳', message: `Awaiting approval: ${config.operation}. Check governance panel →`, type: 'pending' });
      } else if (data.decision === 'deny') {
        setActionStates((prev) => ({ ...prev, [actionId]: { status: 'blocked' } }));
        addActivity({ time: nowTime(), icon: '✗', message: `BLOCKED: ${config.operation} — ${data.reason}`, type: 'blocked' });
        // Reset after 3 seconds
        setTimeout(() => {
          setActionStates((prev) => ({ ...prev, [actionId]: { status: 'idle' } }));
        }, 3000);
      }
    } catch {
      setActionStates((prev) => ({ ...prev, [actionId]: { status: 'idle' } }));
      addActivity({ time: nowTime(), icon: '✗', message: `Error executing ${config.operation}`, type: 'blocked' });
    }
  };

  const selectedSvc = SERVICES[selectedService];
  const logs = LOGS[selectedService] ?? [];

  return (
    <div className="flex w-1/2 flex-col border-r border-[#2A2A2E]">
      {/* Header */}
      <div className="border-b border-[#2A2A2E] px-5 py-4">
        <h2 className="text-base font-medium text-[#E4E4E7]">Infrastructure Overview</h2>
        <p className="mt-1 text-xs text-[#71717A]">AI agent is monitoring 3 services. Governance decisions in real-time.</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Service list */}
        <ServiceList services={SERVICES} selectedId={selectedService} onSelect={setSelectedService} />

        {/* Selected service detail */}
        {selectedSvc && <ServiceCard service={selectedSvc} />}

        {/* Logs (only for user-service) */}
        {logs.length > 0 && <LogViewer logs={logs} />}

        {/* AI Recommendations */}
        <AgentRecommendations actionStates={actionStates} onAction={handleAction} />

        {/* Danger Zone */}
        <DangerZone actionStates={actionStates} onAction={handleAction} />

        {/* Activity Log */}
        <ActivityLog entries={activity} />
      </div>
    </div>
  );
}
