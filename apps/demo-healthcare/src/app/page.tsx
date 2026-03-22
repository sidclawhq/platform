'use client';

import { useState, useEffect } from 'react';
import { DemoHeader } from '@/components/DemoHeader';
import { DemoLayout } from '@/components/DemoLayout';
import { PatientView } from '@/components/PatientView';
import { GovernancePanel } from '@/components/GovernancePanel';
import { DemoFooter } from '@/components/DemoFooter';

export default function DemoPage() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function setup() {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data = await res.json();
      setAgentId(data.agentId);
      setApiKey(data.apiKey);
      setLoading(false);
    }
    setup();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <div className="text-lg font-medium text-[#E4E4E7]">Initializing MedAssist Health demo...</div>
          <div className="mt-2 text-sm text-[#71717A]">Creating clinical AI agent and governance policies</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0B]">
      <DemoHeader />
      <DemoLayout>
        <PatientView agentId={agentId!} apiKey={apiKey!} />
        <GovernancePanel agentId={agentId!} apiKey={apiKey!} />
      </DemoLayout>
      <DemoFooter />
    </div>
  );
}
