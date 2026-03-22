'use client';

import { useState, useEffect } from 'react';
import { DemoHeader } from '@/components/DemoHeader';
import { DemoLayout } from '@/components/DemoLayout';
import { ChatInterface } from '@/components/ChatInterface';
import { GovernancePanel } from '@/components/GovernancePanel';
import { DemoFooter } from '@/components/DemoFooter';

export default function DemoPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function setup() {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data = await res.json();
      setSessionId(data.sessionId);
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
          <div className="text-lg font-medium text-[#E4E4E7]">Setting up Atlas Financial demo...</div>
          <div className="mt-2 text-sm text-[#71717A]">Creating agent and policies</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0B]">
      <DemoHeader />
      <DemoLayout>
        <ChatInterface sessionId={sessionId!} agentId={agentId!} apiKey={apiKey!} />
        <GovernancePanel
          sessionId={sessionId!}
          agentId={agentId!}
          apiKey={apiKey!}
        />
      </DemoLayout>
      <DemoFooter />
    </div>
  );
}
