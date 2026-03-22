'use client';

import { useState, useEffect } from 'react';
import { DemoHeader } from '@/components/DemoHeader';
import { DemoLayout } from '@/components/DemoLayout';
import { OpsDashboard } from '@/components/OpsDashboard';
import { GovernancePanel } from '@/components/GovernancePanel';
import { DemoFooter } from '@/components/DemoFooter';

export default function DemoPage() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        const res = await fetch('/api/setup', { method: 'POST' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          setError(err.error || `Setup failed (${res.status})`);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!data.agentId || !data.apiKey) {
          setError('Setup returned incomplete credentials');
          setLoading(false);
          return;
        }
        setAgentId(data.agentId);
        setApiKey(data.apiKey);
      } catch (e) {
        setError(`Setup failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    }
    setup();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <div className="text-lg font-medium text-[#E4E4E7]">Initializing Nexus DevOps demo...</div>
          <div className="mt-2 text-sm text-[#71717A]">Creating ops agent and governance policies</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-center max-w-md">
          <div className="text-lg font-medium text-[#EF4444]">Demo setup failed</div>
          <div className="mt-2 text-sm text-[#71717A]">{error}</div>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-sm bg-[#27272A] text-[#E4E4E7] rounded hover:bg-[#3F3F46]">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0B]">
      <DemoHeader />
      <DemoLayout>
        <OpsDashboard agentId={agentId!} apiKey={apiKey!} />
        <GovernancePanel agentId={agentId!} apiKey={apiKey!} />
      </DemoLayout>
      <DemoFooter />
    </div>
  );
}
