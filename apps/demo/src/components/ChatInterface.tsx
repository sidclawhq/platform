'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SuggestedPrompts } from './SuggestedPrompts';
import { useRef, useEffect, useMemo, useState } from 'react';
import type { ApprovalNotification } from '@/app/page';

/** Concatenate the text parts of a UIMessage (AI SDK v5+ message shape). */
function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

interface ChatInterfaceProps {
  sessionId: string;
  agentId: string;
  apiKey: string;
  notifications?: ApprovalNotification[];
}

const OP_LABELS: Record<string, string> = {
  send_email: 'Email sent',
  update_case: 'Case updated',
  search: 'Search completed',
  lookup: 'Lookup completed',
};

export function ChatInterface({ sessionId, agentId, apiKey, notifications = [] }: ChatInterfaceProps) {
  // v5+ useChat no longer manages input state or accepts api/body directly —
  // extra request fields travel via the transport, input state is ours.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', body: { sessionId, agentId, apiKey } }),
    [sessionId, agentId, apiKey],
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, notifications]);

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage({ text: prompt });
  };

  return (
    <div className="flex w-1/2 flex-col border-r border-[#2A2A2E]">
      {/* Header */}
      <div className="border-b border-[#2A2A2E] px-6 py-4">
        <h2 className="text-base font-medium text-[#E4E4E7]">Atlas Financial — AI Support Agent</h2>
        <p className="mt-1 text-sm text-[#71717A]">Chat with a real AI agent. Governance decisions happen in real-time.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center">
            <p className="text-base text-[#A1A1AA]">Hello! I&apos;m the Atlas Financial support agent.</p>
            <p className="mt-1 text-base text-[#A1A1AA]">How can I help you today?</p>
            <div className="mt-6">
              <SuggestedPrompts onSelect={handleSuggestedPrompt} />
            </div>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={{ role: message.role, content: messageText(message) }} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-base text-[#71717A]">
            <div className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse" />
            Agent is thinking...
          </div>
        )}

        {/* Approval notifications */}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`rounded-lg px-4 py-3 text-base animate-in ${
              n.action === 'approved'
                ? 'bg-[#22C55E]/10 border border-[#22C55E]/30'
                : 'bg-[#EF4444]/10 border border-[#EF4444]/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                n.action === 'approved'
                  ? 'bg-[#22C55E]/20 text-[#22C55E]'
                  : 'bg-[#EF4444]/20 text-[#EF4444]'
              }`}>
                {n.action === 'approved' ? 'APPROVED' : 'DENIED'}
              </span>
              <span className="text-sm text-[#71717A]">by {n.approver}</span>
            </div>
            <div className="text-[#E4E4E7]">
              {n.action === 'approved'
                ? `${OP_LABELS[n.operation] ?? n.operation} — action approved and executed successfully.`
                : `${OP_LABELS[n.operation] ?? n.operation} — action was denied by reviewer.`
              }
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts — always visible so prospects can try all scenarios */}
      {messages.length > 0 && (
        <div className="border-t border-[#2A2A2E] px-6 py-3">
          <SuggestedPrompts onSelect={handleSuggestedPrompt} compact />
        </div>
      )}

      {/* Input */}
      <ChatInput
        input={input}
        onChange={(e) => setInput(e.target.value)}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
