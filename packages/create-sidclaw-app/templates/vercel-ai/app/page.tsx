'use client';

import { useChat } from '@ai-sdk/react';

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <main style={{ maxWidth: '600px', margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>{{projectName}}</h1>
      <p style={{ color: '#666' }}>
        A governed AI agent. Try these commands:
      </p>
      <ul style={{ color: '#666', fontSize: '0.9rem' }}>
        <li><strong>search for refund policy</strong> → Allowed instantly</li>
        <li><strong>send email to customer</strong> → Requires approval</li>
        <li><strong>export customer data</strong> → Blocked by policy</li>
      </ul>

      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', minHeight: '300px', marginBottom: '1rem' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: '0.5rem' }}>
            <strong>{m.role === 'user' ? 'You' : 'Agent'}:</strong>{' '}
            {m.content}
            {m.toolInvocations?.map((t, i) => (
              <div key={i} style={{
                padding: '0.5rem',
                margin: '0.25rem 0',
                borderRadius: '4px',
                fontSize: '0.85rem',
                backgroundColor: t.state === 'result' ? '#f0f9f0' : '#fff9e6',
              }}>
                Tool: {t.toolName} → {t.state === 'result' ? String(t.result) : 'pending...'}
              </div>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Try: search for refund policy"
          style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', background: '#0070f3', color: 'white', cursor: 'pointer' }}
        >
          Send
        </button>
      </form>

      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#999' }}>
        Dashboard: <a href="https://app.sidclaw.com/dashboard/approvals">app.sidclaw.com/dashboard/approvals</a>
      </p>
    </main>
  );
}
