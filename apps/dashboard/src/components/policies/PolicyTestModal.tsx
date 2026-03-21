'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
import type { AgentSummary, PolicyTestResult as PolicyTestResultType } from '@/lib/api-client';
import { PolicyTestResult } from './PolicyTestResult';

interface PolicyTestModalProps {
  isOpen: boolean;
  agents: AgentSummary[];
  initialValues?: {
    agent_id?: string;
    operation?: string;
    target_integration?: string;
    resource_scope?: string;
    data_classification?: string;
  };
  onClose: () => void;
}

export function PolicyTestModal({
  isOpen,
  agents,
  initialValues,
  onClose,
}: PolicyTestModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const [agentId, setAgentId] = useState('');
  const [operation, setOperation] = useState('');
  const [targetIntegration, setTargetIntegration] = useState('');
  const [resourceScope, setResourceScope] = useState('');
  const [dataClassification, setDataClassification] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PolicyTestResultType | null>(null);
  const [error, setError] = useState('');

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setAgentId(initialValues?.agent_id ?? '');
      setOperation(initialValues?.operation ?? '');
      setTargetIntegration(initialValues?.target_integration ?? '');
      setResourceScope(initialValues?.resource_scope ?? '');
      setDataClassification(initialValues?.data_classification ?? '');
      setResult(null);
      setError('');
    }
  }, [isOpen, initialValues]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const canRun = agentId && operation && targetIntegration && resourceScope && dataClassification;

  const handleRunTest = async () => {
    if (!canRun) return;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await api.testPolicy({
        agent_id: agentId,
        operation,
        target_integration: targetIntegration,
        resource_scope: resourceScope,
        data_classification: dataClassification,
      });
      setResult(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Test evaluation failed';
      setError(message);
    } finally {
      setRunning(false);
    }
  };

  const activeAgents = agents.filter((a) => a.lifecycle_state === 'active');

  const labelClass = 'text-xs text-text-muted uppercase tracking-wider font-medium mb-1 block';
  const inputClass =
    'w-full bg-surface-1 border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue';

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] overflow-y-auto"
    >
      <div className="bg-surface-0 border border-border rounded-lg p-6 w-full max-w-[560px] mb-10">
        <h2 className="text-base font-medium text-foreground mb-1">
          Test Policy Evaluation
        </h2>
        <p className="text-sm text-text-secondary mb-5">
          Simulate a policy evaluation without creating a trace.
        </p>

        <div className="space-y-4">
          {/* Agent */}
          <div>
            <label className={labelClass}>Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select an agent...</option>
              {activeAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Operation */}
          <div>
            <label className={labelClass}>Operation</label>
            <input
              type="text"
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className={inputClass}
              placeholder='e.g., "send"'
            />
          </div>

          {/* Target Integration */}
          <div>
            <label className={labelClass}>Target Integration</label>
            <input
              type="text"
              value={targetIntegration}
              onChange={(e) => setTargetIntegration(e.target.value)}
              className={inputClass}
              placeholder='e.g., "communications_service"'
            />
          </div>

          {/* Resource Scope */}
          <div>
            <label className={labelClass}>Resource Scope</label>
            <input
              type="text"
              value={resourceScope}
              onChange={(e) => setResourceScope(e.target.value)}
              className={inputClass}
              placeholder='e.g., "customer_emails"'
            />
          </div>

          {/* Data Classification */}
          <div>
            <label className={labelClass}>Data Classification</label>
            <select
              value={dataClassification}
              onChange={(e) => setDataClassification(e.target.value)}
              className={inputClass}
            >
              <option value="">Select...</option>
              <option value="public">Public</option>
              <option value="internal">Internal</option>
              <option value="confidential">Confidential</option>
              <option value="restricted">Restricted</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded border border-accent-red bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="bg-surface-2 text-text-secondary px-6 py-2 rounded text-sm hover:bg-surface-2/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRunTest}
            disabled={!canRun || running}
            className="bg-accent-blue text-white px-6 py-2 rounded font-medium text-sm hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
          >
            {running ? 'Running...' : 'Run Test'}
          </button>
        </div>

        {/* Result */}
        {result && <PolicyTestResult result={result} />}
      </div>
    </div>
  );
}
