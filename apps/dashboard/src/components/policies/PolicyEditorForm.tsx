'use client';

import { useState } from 'react';
import type { AgentSummary, PolicyListItem } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface PolicyEditorFormProps {
  agents: AgentSummary[];
  initialData?: PolicyListItem;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  agent_id: string;
  policy_name: string;
  operation: string;
  target_integration: string;
  resource_scope: string;
  data_classification: string;
  policy_effect: string;
  priority: number;
  rationale: string;
  max_session_ttl: number | string;
}

interface FormErrors {
  [key: string]: string | undefined;
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.agent_id) errors.agent_id = 'Agent is required';
  if (!values.policy_name || values.policy_name.length < 3)
    errors.policy_name = 'Name must be at least 3 characters';
  if (values.policy_name && values.policy_name.length > 100)
    errors.policy_name = 'Name must be at most 100 characters';
  if (!values.operation) errors.operation = 'Operation is required';
  if (!values.target_integration) errors.target_integration = 'Target integration is required';
  if (!values.resource_scope) errors.resource_scope = 'Resource scope is required';
  if (!values.data_classification) errors.data_classification = 'Classification is required';
  if (!values.policy_effect) errors.policy_effect = 'Effect is required';
  if (!values.priority || values.priority < 1 || values.priority > 1000)
    errors.priority = 'Priority must be between 1 and 1000';
  if (!values.rationale || values.rationale.length < 10)
    errors.rationale = 'Rationale must be at least 10 characters';
  if (values.rationale && values.rationale.length > 1000)
    errors.rationale = 'Rationale must be at most 1000 characters';
  if (values.policy_effect === 'approval_required' && values.max_session_ttl) {
    const ttl = Number(values.max_session_ttl);
    if (isNaN(ttl) || ttl < 60 || ttl > 86400)
      errors.max_session_ttl = 'TTL must be between 60 and 86400 seconds';
  }
  return errors;
}

export function PolicyEditorForm({ agents, initialData, onSubmit, onCancel }: PolicyEditorFormProps) {
  const { user } = useAuth();
  const [values, setValues] = useState<FormValues>({
    agent_id: initialData?.agent_id ?? '',
    policy_name: initialData?.policy_name ?? '',
    operation: initialData?.operation ?? '',
    target_integration: initialData?.target_integration ?? '',
    resource_scope: initialData?.resource_scope ?? '',
    data_classification: initialData?.data_classification ?? '',
    policy_effect: initialData?.policy_effect ?? '',
    priority: initialData?.priority ?? 100,
    rationale: initialData?.rationale ?? '',
    max_session_ttl: initialData?.max_session_ttl ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof FormValues, value: string | number) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        agent_id: values.agent_id,
        policy_name: values.policy_name,
        operation: values.operation,
        target_integration: values.target_integration,
        resource_scope: values.resource_scope,
        data_classification: values.data_classification,
        policy_effect: values.policy_effect,
        priority: Number(values.priority),
        rationale: values.rationale,
        conditions: null,
        max_session_ttl:
          values.policy_effect === 'approval_required' && values.max_session_ttl
            ? Number(values.max_session_ttl)
            : null,
        modified_by: user?.name ?? 'Unknown',
        modified_at: new Date().toISOString(),
      };

      // For updates, only send changed fields (except agent_id which isn't updatable)
      if (initialData) {
        const updatePayload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload)) {
          if (key === 'agent_id' || key === 'modified_by' || key === 'modified_at') continue;
          updatePayload[key] = value;
        }
        await onSubmit(updatePayload);
      } else {
        await onSubmit(payload);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setServerError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = 'text-xs text-text-muted uppercase tracking-wider font-medium mb-1 block';
  const inputClass =
    'w-full bg-surface-1 border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-blue';
  const errorInputClass =
    'w-full bg-surface-1 border border-accent-red rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent-red';
  const errorTextClass = 'text-xs text-accent-red mt-1';

  const activeAgents = agents.filter((a) => a.lifecycle_state === 'active');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Agent */}
      <div>
        <label className={labelClass}>Agent</label>
        <select
          value={values.agent_id}
          onChange={(e) => handleChange('agent_id', e.target.value)}
          className={errors.agent_id ? errorInputClass : inputClass}
          disabled={!!initialData}
        >
          <option value="">Select an agent...</option>
          {activeAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        {errors.agent_id && <p className={errorTextClass}>{errors.agent_id}</p>}
      </div>

      {/* Policy Name */}
      <div>
        <label className={labelClass}>Policy Name</label>
        <input
          type="text"
          value={values.policy_name}
          onChange={(e) => handleChange('policy_name', e.target.value)}
          className={errors.policy_name ? errorInputClass : inputClass}
          placeholder="e.g., Outbound customer email review"
        />
        {errors.policy_name && <p className={errorTextClass}>{errors.policy_name}</p>}
      </div>

      {/* Operation + Target Integration (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Operation</label>
          <input
            type="text"
            value={values.operation}
            onChange={(e) => handleChange('operation', e.target.value)}
            className={errors.operation ? errorInputClass : inputClass}
            placeholder="e.g., send"
          />
          {errors.operation && <p className={errorTextClass}>{errors.operation}</p>}
        </div>
        <div>
          <label className={labelClass}>Target Integration</label>
          <input
            type="text"
            value={values.target_integration}
            onChange={(e) => handleChange('target_integration', e.target.value)}
            className={errors.target_integration ? errorInputClass : inputClass}
            placeholder="e.g., communications_service"
          />
          {errors.target_integration && (
            <p className={errorTextClass}>{errors.target_integration}</p>
          )}
        </div>
      </div>

      {/* Resource Scope */}
      <div>
        <label className={labelClass}>Resource Scope</label>
        <input
          type="text"
          value={values.resource_scope}
          onChange={(e) => handleChange('resource_scope', e.target.value)}
          className={errors.resource_scope ? errorInputClass : inputClass}
          placeholder='e.g., customer_emails or *'
        />
        {errors.resource_scope && <p className={errorTextClass}>{errors.resource_scope}</p>}
      </div>

      {/* Data Classification + Effect (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Data Classification</label>
          <select
            value={values.data_classification}
            onChange={(e) => handleChange('data_classification', e.target.value)}
            className={errors.data_classification ? errorInputClass : inputClass}
          >
            <option value="">Select...</option>
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
          {errors.data_classification && (
            <p className={errorTextClass}>{errors.data_classification}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Effect</label>
          <select
            value={values.policy_effect}
            onChange={(e) => handleChange('policy_effect', e.target.value)}
            className={errors.policy_effect ? errorInputClass : inputClass}
          >
            <option value="">Select...</option>
            <option value="allow">Allow</option>
            <option value="approval_required">Approval Required</option>
            <option value="deny">Deny</option>
          </select>
          {errors.policy_effect && <p className={errorTextClass}>{errors.policy_effect}</p>}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className={labelClass}>Priority</label>
        <input
          type="number"
          value={values.priority}
          onChange={(e) => handleChange('priority', parseInt(e.target.value, 10) || 0)}
          className={errors.priority ? errorInputClass : inputClass}
          min={1}
          max={1000}
        />
        {errors.priority && <p className={errorTextClass}>{errors.priority}</p>}
      </div>

      {/* Max Session TTL — only when effect = approval_required */}
      {values.policy_effect === 'approval_required' && (
        <div>
          <label className={labelClass}>Max Session TTL (seconds)</label>
          <input
            type="number"
            value={values.max_session_ttl}
            onChange={(e) => handleChange('max_session_ttl', e.target.value)}
            className={errors.max_session_ttl ? errorInputClass : inputClass}
            min={60}
            max={86400}
            placeholder="86400"
          />
          <p className="text-xs text-text-muted mt-1">
            Approval timeout in seconds (default: 24 hours)
          </p>
          {errors.max_session_ttl && <p className={errorTextClass}>{errors.max_session_ttl}</p>}
        </div>
      )}

      {/* Rationale */}
      <div>
        <label className={labelClass}>Rationale</label>
        <textarea
          value={values.rationale}
          onChange={(e) => handleChange('rationale', e.target.value)}
          className={errors.rationale ? errorInputClass : inputClass}
          rows={3}
          placeholder="Explain WHY this policy exists, not just what it does"
        />
        <p className="text-xs text-text-muted mt-1">
          Explain WHY this policy exists, not just what it does
        </p>
        {errors.rationale && <p className={errorTextClass}>{errors.rationale}</p>}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded border border-accent-red bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-surface-2 text-text-secondary px-6 py-2 rounded text-sm hover:bg-surface-2/80 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent-blue text-white px-6 py-2 rounded text-sm hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving...' : initialData ? 'Update Policy' : 'Create Policy'}
        </button>
      </div>
    </form>
  );
}
