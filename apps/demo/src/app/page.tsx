'use client';

import { useState, useEffect, useCallback } from 'react';
import { DemoHeader } from '@/components/DemoHeader';
import { DemoLayout } from '@/components/DemoLayout';
import { ChatInterface } from '@/components/ChatInterface';
import { GovernancePanel } from '@/components/GovernancePanel';
import { DemoFooter } from '@/components/DemoFooter';

export interface ApprovalNotification {
  id: string;
  action: 'approved' | 'denied';
  operation: string;
  target: string;
  approver: string;
  timestamp: number;
}

export default function DemoPage() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<ApprovalNotification[]>([]);

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

  const handleApprovalResolved = useCallback((notification: ApprovalNotification) => {
    setNotifications((prev) => [notification, ...prev]);
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, 8000);
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
        <ChatInterface
          sessionId=""
          agentId={agentId!}
          apiKey={apiKey!}
          notifications={notifications}
        />
        <GovernancePanel
          agentId={agentId!}
          apiKey={apiKey!}
          onApprovalResolved={handleApprovalResolved}
        />
      </DemoLayout>
      <DemoFooter />
    </div>
  );
}
