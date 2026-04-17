'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';

interface AgentRow {
  id: string;
  name: string;
}

type IntegrationKey =
  | 'claude-code-hooks'
  | 'mcp-tools'
  | 'mcp-proxy'
  | 'sdk-typescript'
  | 'sdk-python'
  | 'langchain-python'
  | 'langchain-js'
  | 'create-sidclaw-app';

const API_KEY_PLACEHOLDER = '$SIDCLAW_API_KEY';

// Derive API base URL with multiple fallbacks. In order of preference:
//   1. NEXT_PUBLIC_API_URL (explicit override)
//   2. window.location-based heuristic (app.* → api.*, :3000 → :4000)
//   3. https://api.sidclaw.com (production default)
// The tenant info endpoint can also supply the authoritative URL post-mount.
function deriveApiBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_API_URL;
  if (override) return override.replace(/\/+$/, '');
  if (typeof window === 'undefined') return 'https://api.sidclaw.com';
  const origin = window.location.origin;
  // app.sidclaw.com → api.sidclaw.com
  if (/^https?:\/\/app\./.test(origin)) {
    return origin.replace(/^(https?:\/\/)app\./, '$1api.');
  }
  // localhost:3000/3010 → localhost:4000
  if (/:(3000|3010)$/.test(origin)) {
    return origin.replace(/:\d+$/, ':4000');
  }
  // Self-hosted custom domain — no reliable transform. Fall back to the
  // standard prod URL and let the user edit.
  return 'https://api.sidclaw.com';
}

export default function ConnectPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [revealKey, setRevealKey] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(() => deriveApiBaseUrl());
  const [active, setActive] = useState<IntegrationKey>('claude-code-hooks');
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: AgentRow[] }>('/api/v1/agents').then((res) => {
      setAgents(res.data);
      if (res.data[0]) setSelectedAgent(res.data[0].id);
    }).catch(() => setAgents([]));

    // Prefer the seed/onboarding key exposed via session storage. We keep
    // it out of the DOM by default (see `revealKey`); pasted snippets use
    // the $SIDCLAW_API_KEY placeholder until the user explicitly reveals.
    const stored = sessionStorage.getItem('onboarding_api_key');
    if (stored) setApiKey(stored);

    // Fetch authoritative API URL from the server as defense-in-depth
    // against the heuristic above misbehaving on self-hosted deploys.
    api.get<{ data: { api_url?: string } }>('/api/v1/tenant/info')
      .then((res) => {
        if (res.data?.api_url) setApiBaseUrl(res.data.api_url.replace(/\/+$/, ''));
      })
      .catch(() => {});
  }, []);

  // The key that gets pasted into snippets. If the user hasn't revealed
  // their real key, use the shell-variable placeholder — never leak the
  // key through copy-paste unless the user explicitly asked.
  const keyForSnippets = useMemo(() => {
    if (revealKey && apiKey) return apiKey;
    return API_KEY_PLACEHOLDER;
  }, [revealKey, apiKey]);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock(null), 1200);
  };

  const agentId = selectedAgent || 'your-agent-id';

  const snippets: Record<IntegrationKey, { title: string; description: string; blocks: Array<{ lang: string; code: string }>; notes?: string }> = {
    'claude-code-hooks': {
      title: 'Claude Code Hooks (zero code)',
      description:
        'Every Bash/Write/Edit/mcp_* tool call is evaluated by SidClaw. No SDK, no framework change.',
      blocks: [
        {
          lang: 'bash',
          // Zero-dependency install — curl the installer script and pipe to node.
          // Works in any project that has Node, regardless of its package.json.
          code: 'curl -fsSL https://sidclaw.com/install-hooks.mjs | node',
        },
        {
          lang: 'bash',
          code: `export SIDCLAW_BASE_URL=${apiBaseUrl}
export SIDCLAW_API_KEY=${keyForSnippets}
export SIDCLAW_AGENT_ID=${agentId}`,
        },
      ],
      notes:
        'Run once inside your project (any Node 18+ project works). Restart Claude Code after setting env vars. Alternatively, clone sidclawhq/platform and run `npm run hooks:install --target=/path/to/your/project`.',
    },
    'mcp-tools': {
      title: 'MCP Governance Tools (zero code, self-instrumenting agents)',
      description:
        'Expose sidclaw_evaluate / sidclaw_approve / sidclaw_record as MCP tools. The agent calls them directly.',
      blocks: [
        {
          lang: 'json',
          code: `{
  "mcpServers": {
    "sidclaw": {
      "command": "npx",
      "args": ["-y", "@sidclaw/mcp-tools"],
      "env": {
        "SIDCLAW_BASE_URL": "${apiBaseUrl}",
        "SIDCLAW_API_KEY": "${keyForSnippets}",
        "SIDCLAW_AGENT_ID": "${agentId}"
      }
    }
  }
}`,
        },
      ],
    },
    'mcp-proxy': {
      title: 'MCP Governance Proxy (wraps any MCP server)',
      description:
        'Transparent proxy — every tool call on the upstream MCP server is policy-checked first.',
      blocks: [
        {
          lang: 'json',
          code: `{
  "mcpServers": {
    "postgres-governed": {
      "command": "npx",
      "args": ["-y", "@sidclaw/sdk", "sidclaw-mcp-proxy", "--transport", "stdio"],
      "env": {
        "SIDCLAW_API_KEY": "${keyForSnippets}",
        "SIDCLAW_AGENT_ID": "${agentId}",
        "SIDCLAW_UPSTREAM_CMD": "npx",
        "SIDCLAW_UPSTREAM_ARGS": "-y,@modelcontextprotocol/server-postgres,postgresql://localhost/mydb"
      }
    }
  }
}`,
        },
      ],
    },
    'sdk-typescript': {
      title: 'TypeScript SDK',
      description: 'Wrap any async function with withGovernance for one-line enforcement.',
      blocks: [
        { lang: 'bash', code: 'npm install @sidclaw/sdk' },
        {
          lang: 'typescript',
          code: `import { AgentIdentityClient, withGovernance } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: '${apiBaseUrl}',
  agentId: '${agentId}',
});

const sendEmail = withGovernance(client, {
  operation: 'send_email',
  target_integration: 'email_service',
  resource_scope: 'customer_emails',
  data_classification: 'confidential',
}, async (to, subject, body) => {
  // your email-sending logic
});`,
        },
      ],
    },
    'sdk-python': {
      title: 'Python SDK',
      description: 'The @with_governance decorator wraps any function.',
      blocks: [
        { lang: 'bash', code: 'pip install sidclaw' },
        {
          lang: 'python',
          code: `import os
from sidclaw import SidClaw
from sidclaw.middleware.generic import with_governance, GovernanceConfig

client = SidClaw(
    api_key=os.environ["SIDCLAW_API_KEY"],
    agent_id="${agentId}",
    api_url="${apiBaseUrl}",
)

@with_governance(client, GovernanceConfig(
    operation="send_email",
    target_integration="email_service",
    data_classification="confidential",
))
def send_email(to, subject, body):
    # your email-sending logic
    ...`,
        },
      ],
    },
    'langchain-python': {
      title: 'LangChain (Python)',
      description: 'Wrap a tool array — no change to your chain.',
      blocks: [
        { lang: 'bash', code: 'pip install langchain-sidclaw' },
        {
          lang: 'python',
          code: `from sidclaw.middleware.langchain import govern_tools
from langchain_core.tools import tool

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    ...

governed_tools = govern_tools(client, [send_email])`,
        },
      ],
    },
    'langchain-js': {
      title: 'LangChain (JavaScript)',
      description: 'Same pattern for @langchain/core.',
      blocks: [
        { lang: 'bash', code: 'npm install @sidclaw/langchain-governance' },
        {
          lang: 'typescript',
          code: `import { governTools } from '@sidclaw/sdk/langchain';
const governedTools = governTools(client, [sendEmailTool]);`,
        },
      ],
    },
    'create-sidclaw-app': {
      title: 'Interactive scaffold',
      description: 'One command, pick a framework, get a running governed agent.',
      blocks: [{ lang: 'bash', code: 'npx create-sidclaw-app' }],
    },
  };

  const tabs: Array<{ key: IntegrationKey; label: string }> = [
    { key: 'claude-code-hooks', label: 'Claude Code' },
    { key: 'mcp-tools', label: 'MCP Tools' },
    { key: 'mcp-proxy', label: 'MCP Proxy' },
    { key: 'sdk-typescript', label: 'SDK (TS)' },
    { key: 'sdk-python', label: 'SDK (Python)' },
    { key: 'langchain-python', label: 'LangChain (Py)' },
    { key: 'langchain-js', label: 'LangChain (JS)' },
    { key: 'create-sidclaw-app', label: 'Scaffold CLI' },
  ];

  const current = snippets[active];

  return (
    <div className="px-6 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Connect an agent</h1>
        <p className="text-sm text-text-secondary">
          Copy a snippet. Your API key and an agent ID are pre-filled. Every governed action
          will appear in the Audit timeline within seconds.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-md border border-border bg-surface-1 p-4">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">Agent</label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">(pick an agent)</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-text-muted">
            API key
            <span className="ml-2 normal-case text-text-dim">
              {revealKey ? 'visible — copied into snippets' : 'masked — snippets use $SIDCLAW_API_KEY'}
            </span>
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type={revealKey ? 'text' : 'password'}
              className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[12px]"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ai_..."
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setRevealKey((v) => !v)}
              aria-label={revealKey ? 'Hide API key' : 'Reveal API key'}
              className="rounded-md border border-border bg-surface-2 px-3 text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40"
            >
              {revealKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              active === t.key
                ? 'border-amber-500 text-foreground'
                : 'border-transparent text-text-secondary hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-base font-medium mb-1">{current.title}</h2>
        <p className="text-sm text-text-secondary mb-4">{current.description}</p>

        <div className="space-y-3">
          {current.blocks.map((block, idx) => {
            const id = `${active}-${idx}`;
            const copied = copiedBlock === id;
            return (
              <div key={id} className="rounded-md border border-border bg-surface-1 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                    {block.lang}
                  </span>
                  <button
                    onClick={() => handleCopy(id, block.code)}
                    className="flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-foreground"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="px-4 py-3 text-[12px] font-mono text-foreground overflow-x-auto whitespace-pre">
                  {block.code}
                </pre>
              </div>
            );
          })}
        </div>

        {current.notes && (
          <p className="text-sm text-text-muted mt-4 italic">{current.notes}</p>
        )}

        <div className="mt-6 flex gap-4">
          <a
            href="https://docs.sidclaw.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-foreground"
          >
            Full docs <ExternalLink size={12} />
          </a>
          <a
            href="/dashboard/audit"
            className="flex items-center gap-1 text-sm text-text-secondary hover:text-foreground"
          >
            Open Audit timeline →
          </a>
        </div>
      </section>
    </div>
  );
}
