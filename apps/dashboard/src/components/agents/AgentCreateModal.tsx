'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface AgentCreateModalProps {
  onClose: () => void;
  onCreated: (agentId: string) => void;
}

const ENVIRONMENTS = ['dev', 'test', 'prod'] as const;
const AUTHORITY_MODELS = ['self', 'delegated', 'hybrid'] as const;
const IDENTITY_MODES = ['service_identity', 'delegated_identity', 'hybrid_identity'] as const;
const DELEGATION_MODELS = ['self', 'on_behalf_of_user', 'on_behalf_of_owner', 'mixed'] as const;
const AUTONOMY_TIERS = ['low', 'medium', 'high'] as const;

export function AgentCreateModal({ onClose, onCreated }: AgentCreateModalProps) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerName, setOwnerName] = useState(user?.name ?? '');
  const [ownerRole, setOwnerRole] = useState('');
  const [team, setTeam] = useState('');
  const [environment, setEnvironment] = useState<string>('dev');
  const [authorityModel, setAuthorityModel] = useState<string>('self');
  const [identityMode, setIdentityMode] = useState<string>('service_identity');
  const [delegationModel, setDelegationModel] = useState<string>('self');
  const [autonomyTier, setAutonomyTier] = useState<string>('low');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await api.createAgent({
        name: name.trim(),
        description: description.trim(),
        owner_name: ownerName.trim(),
        owner_role: ownerRole.trim(),
        team: team.trim(),
        environment,
        authority_model: authorityModel,
        identity_mode: identityMode,
        delegation_model: delegationModel,
        autonomy_tier: autonomyTier,
        authorized_integrations: [],
        created_by: user?.name ?? 'Dashboard User',
      });

      toast.success(`Agent "${name}" registered`);
      onCreated(result.data.id);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Failed to create agent');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-ring';
  const labelClass = 'block text-sm font-medium text-foreground';
  const selectClass =
    'mt-1 w-full rounded border border-border bg-surface-0 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-[var(--border-default)] bg-[var(--surface-1)] p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-foreground">Register Agent</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Create a new agent identity for governance tracking.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="agent-name" className={labelClass}>Name</label>
            <input id="agent-name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Support Bot" className={inputClass} />
          </div>

          <div>
            <label htmlFor="agent-desc" className={labelClass}>Description</label>
            <textarea id="agent-desc" required rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="owner-name" className={labelClass}>Owner Name</label>
              <input id="owner-name" type="text" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label htmlFor="owner-role" className={labelClass}>Owner Role</label>
              <input id="owner-role" type="text" required value={ownerRole} onChange={(e) => setOwnerRole(e.target.value)}
                placeholder="e.g. Engineering Lead" className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="team" className={labelClass}>Team</label>
            <input id="team" type="text" required value={team} onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Platform Engineering" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="environment" className={labelClass}>Environment</label>
              <select id="environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} className={selectClass}>
                {ENVIRONMENTS.map((env) => (
                  <option key={env} value={env}>{env}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="autonomy" className={labelClass}>Autonomy Tier</label>
              <select id="autonomy" value={autonomyTier} onChange={(e) => setAutonomyTier(e.target.value)} className={selectClass}>
                {AUTONOMY_TIERS.map((tier) => (
                  <option key={tier} value={tier}>{tier}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label htmlFor="authority" className={labelClass}>Authority</label>
              <select id="authority" value={authorityModel} onChange={(e) => setAuthorityModel(e.target.value)} className={selectClass}>
                {AUTHORITY_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="identity" className={labelClass}>Identity</label>
              <select id="identity" value={identityMode} onChange={(e) => setIdentityMode(e.target.value)} className={selectClass}>
                {IDENTITY_MODES.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="delegation" className={labelClass}>Delegation</label>
              <select id="delegation" value={delegationModel} onChange={(e) => setDelegationModel(e.target.value)} className={selectClass}>
                {DELEGATION_MODELS.map((m) => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90 transition-colors disabled:opacity-50">
              {submitting ? 'Registering...' : 'Register Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
