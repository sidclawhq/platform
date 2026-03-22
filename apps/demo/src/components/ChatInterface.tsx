'use client';

import { useChat } from 'ai/react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SuggestedPrompts } from './SuggestedPrompts';
import { useRef, useEffect } from 'react';

interface ChatInterfaceProps {
  sessionId: string;
  agentId: string;
  apiKey: string;
}

export function ChatInterface({ sessionId, agentId, apiKey }: ChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    body: { sessionId, agentId, apiKey },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSuggestedPrompt = (prompt: string) => {
    append({ role: 'user', content: prompt });
  };

  return (
    <div className="flex w-1/2 flex-col border-r border-[#2A2A2E]">
      {/* Header */}
      <div className="border-b border-[#2A2A2E] px-6 py-4">
        <h2 className="text-base font-medium text-[#E4E4E7]">Atlas Financial — AI Support Agent</h2>
        <p className="mt-1 text-xs text-[#71717A]">Chat with a real AI agent. Governance decisions happen in real-time.</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-[#A1A1AA]">Hello! I&apos;m the Atlas Financial support agent.</p>
            <p className="mt-1 text-sm text-[#A1A1AA]">How can I help you today?</p>
            <div className="mt-6">
              <SuggestedPrompts onSelect={handleSuggestedPrompt} />
            </div>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-[#71717A]">
            <div className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse" />
            Agent is thinking...
          </div>
        )}
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
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
