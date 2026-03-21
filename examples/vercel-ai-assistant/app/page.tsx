'use client';

import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      {/* Header */}
      <div className="mb-4 border-b border-zinc-800 pb-4">
        <h1 className="text-lg font-semibold text-zinc-100">SidClaw Governed Assistant</h1>
        <p className="text-sm text-zinc-500">
          Tools are governed by policy. Try asking to check inventory, send an email, or delete records.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="mt-8 space-y-3 text-center">
            <p className="text-zinc-500">Try one of these:</p>
            <div className="space-y-2">
              {[
                'Check inventory for Widget A',
                'Send a notification email to alice@example.com',
                'Delete all records for customer-123',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="block w-full rounded border border-zinc-800 px-4 py-2 text-left text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                  onClick={() => {
                    const form = document.querySelector('form');
                    const textarea = form?.querySelector('input');
                    if (textarea) {
                      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        'value'
                      )?.set;
                      nativeInputValueSetter?.call(textarea, suggestion);
                      textarea.dispatchEvent(new Event('input', { bubbles: true }));
                      form?.requestSubmit();
                    }
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
              }`}
            >
              <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
              {message.toolInvocations?.map((invocation, i) => (
                <div key={i} className="mt-2 rounded border border-zinc-700 bg-zinc-950 p-2 text-xs">
                  <span className="font-mono text-zinc-500">tool: {invocation.toolName}</span>
                  {'result' in invocation && (
                    <pre className="mt-1 text-zinc-400 whitespace-pre-wrap">
                      {typeof invocation.result === 'string'
                        ? invocation.result
                        : JSON.stringify(invocation.result, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-500">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-800 pt-4">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something..."
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-600 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
