# Task: Interactive Demo Application — Atlas Financial

## Context

You are working on the **Agent Identity & Approval Layer** project (brand: **SidClaw**). Read these files first:

1. `research/2026-03-20-product-development-plan.md` — Overview, architecture, design tokens.
2. `apps/landing/src/` — landing page for design reference (same "Institutional Calm" aesthetic).
3. `packages/sdk/src/` — SDK source (you will use `AgentIdentityClient` and `withGovernance`).
4. `apps/dashboard/src/app/globals.css` — design tokens.
5. `examples/langchain-customer-support/` — existing LangChain example for reference.

Your job is to build an interactive demo application at `apps/demo/` — a split-screen experience where prospects chat with a real AI agent and watch governance happen in real-time on the right side.

**This is a sales tool, not a feature.** It must be polished, self-explanatory, and create three "wow" moments in under 3 minutes.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Demo Page (apps/demo)                                   │
│                                                          │
│  ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │ Chat Interface   │    │ Governance Panel             │  │
│  │                  │    │                              │  │
│  │ Vercel AI SDK    │    │ Polls GET /api/v1/traces     │  │
│  │ streaming chat   │    │ and GET /api/v1/approvals    │  │
│  │ with LangChain   │    │ to show live activity        │  │
│  │ governed tools   │    │                              │  │
│  └────────┬─────────┘    │ Shows approval cards with    │  │
│           │              │ Approve/Deny buttons that    │  │
│           ▼              │ call the real API             │  │
│     SidClaw API          │                              │  │
│     (real evaluation,    └──────────────────────────────┘  │
│      real traces,                                         │
│      real approvals)                                      │
└─────────────────────────────────────────────────────────────┘
```

The chat uses **real SidClaw governance** (real API, real policies, real traces) but **mock business tools** (hardcoded responses — no real CRM, no real email sending). The governance is 100% authentic.

## What To Do

### 1. Initialize Demo App

```bash
cd apps
npx create-next-app demo --typescript --tailwind --app --src-dir
cd demo
npm install ai @ai-sdk/anthropic @langchain/core @langchain/anthropic @sidclaw/sdk sonner lucide-react
```

Configure with the same "Institutional Calm" design tokens as the dashboard and landing page. Port: 3003.

### 2. Directory Structure

```
apps/demo/
  src/
    app/
      page.tsx                        # Split-screen demo page
      layout.tsx                      # Root layout (dark theme, fonts)
      globals.css                     # Design tokens (copy from dashboard)
      api/
        chat/route.ts                 # AI SDK streaming route handler
        governance/route.ts           # SSE endpoint for real-time governance updates
        setup/route.ts                # POST: creates demo tenant/agent/policies on first visit
    components/
      DemoLayout.tsx                  # Split-screen container
      ChatInterface.tsx               # Left side: chat
      ChatMessage.tsx                 # Single message bubble
      ChatInput.tsx                   # Input bar with send button
      SuggestedPrompts.tsx            # Scenario buttons below chat
      GovernancePanel.tsx             # Right side: live governance view
      GovernanceEvent.tsx             # Single governance event card
      ApprovalCard.tsx                # Inline approval card with Approve/Deny
      TraceTimeline.tsx               # Mini trace timeline (simplified)
      DemoHeader.tsx                  # Top bar with SidClaw logo + links
      DemoFooter.tsx                  # Bottom bar with CTAs
    lib/
      demo-tools.ts                   # Mock tool definitions
      demo-agent.ts                   # LangChain agent configuration
      demo-session.ts                 # Demo session management (tenant/agent per visitor)
      governance-poller.ts            # Client-side polling for governance updates
  package.json
  next.config.ts
  tailwind.config.ts
  tsconfig.json
```

### 3. Demo Session Management (`lib/demo-session.ts`)

Each demo visitor gets an isolated session with their own tenant, agent, and policies. This prevents demo sessions from interfering with each other.

```typescript
import { randomBytes, createHash } from 'crypto';

const DEMO_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';
const DEMO_ADMIN_KEY = process.env.DEMO_ADMIN_API_KEY!; // A master API key with admin scope

interface DemoSession {
  sessionId: string;
  tenantId: string;
  agentId: string;
  apiKey: string;       // scoped key for this demo session
  createdAt: number;
}

// In-memory store — fine for demo (not production)
const sessions = new Map<string, DemoSession>();

export async function getOrCreateDemoSession(sessionId: string | null): Promise<DemoSession> {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const newSessionId = randomBytes(16).toString('hex');

  // For the demo, we'll use the seed tenant and create a demo-specific agent
  // This avoids needing to create tenants dynamically (which would require admin-level signup)

  // Alternative approach: use a shared demo tenant with a fixed API key
  // and create unique agent names per session to keep traces separate

  const agentName = `Atlas Support Agent (demo-${newSessionId.substring(0, 8)})`;

  // Create demo agent via API
  const agentRes = await fetch(`${DEMO_API_URL}/api/v1/agents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEMO_ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: agentName,
      description: 'Atlas Financial customer support AI agent — interactive demo',
      owner_name: 'Maria Chen',
      owner_role: 'VP Customer Support',
      team: 'Atlas Financial — Customer Operations',
      environment: 'prod',
      authority_model: 'delegated',
      identity_mode: 'delegated_identity',
      delegation_model: 'on_behalf_of_owner',
      autonomy_tier: 'medium',
      authorized_integrations: [
        { name: 'Knowledge Base', resource_scope: 'internal_docs', data_classification: 'internal', allowed_operations: ['search'] },
        { name: 'Customer CRM', resource_scope: 'customer_records', data_classification: 'confidential', allowed_operations: ['read'] },
        { name: 'Email Service', resource_scope: 'customer_emails', data_classification: 'confidential', allowed_operations: ['send'] },
        { name: 'Case Management', resource_scope: 'support_cases', data_classification: 'confidential', allowed_operations: ['read', 'update'] },
      ],
      created_by: 'demo-setup',
    }),
  });
  const agent = await agentRes.json();
  const agentId = agent.data.id;

  // Create 6 policies
  const policies = [
    {
      policy_name: 'Allow knowledge base search',
      operation: 'search',
      target_integration: 'knowledge_base',
      resource_scope: 'internal_docs',
      data_classification: 'internal',
      policy_effect: 'allow',
      rationale: 'Read-only access to internal documentation is within the agent\'s standard operational scope and poses no compliance risk.',
      priority: 100,
    },
    {
      policy_name: 'Allow customer account lookup',
      operation: 'lookup',
      target_integration: 'customer_crm',
      resource_scope: 'customer_records',
      data_classification: 'confidential',
      policy_effect: 'allow',
      rationale: 'Reading customer account details for support context is permitted under the agent\'s delegated authority with existing access controls.',
      priority: 100,
    },
    {
      policy_name: 'Require approval for outbound customer emails',
      operation: 'send_email',
      target_integration: 'email_service',
      resource_scope: 'customer_emails',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Outbound customer communications require human review before sending to ensure compliance with FINRA communication standards and data handling policies.',
      priority: 100,
      max_session_ttl: 300,  // 5 minutes for demo
    },
    {
      policy_name: 'Require approval for case updates',
      operation: 'update_case',
      target_integration: 'case_management',
      resource_scope: 'support_cases',
      data_classification: 'confidential',
      policy_effect: 'approval_required',
      rationale: 'Modifying support case records requires human review under operational risk policy to ensure proper documentation and financial reconciliation.',
      priority: 100,
      max_session_ttl: 300,
    },
    {
      policy_name: 'Block customer data export',
      operation: 'export_data',
      target_integration: 'customer_crm',
      resource_scope: 'customer_pii',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Bulk export of customer personally identifiable information is prohibited under data protection policy, regardless of delegated authority or stated business justification.',
      priority: 200,
    },
    {
      policy_name: 'Block account closure',
      operation: 'close_account',
      target_integration: 'customer_crm',
      resource_scope: 'customer_accounts',
      data_classification: 'restricted',
      policy_effect: 'deny',
      rationale: 'Account closure is an irreversible financial action that exceeds the operational authority of automated agents and requires direct human processing.',
      priority: 200,
    },
  ];

  for (const policy of policies) {
    await fetch(`${DEMO_API_URL}/api/v1/policies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEMO_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        ...policy,
        modified_by: 'demo-setup',
      }),
    });
  }

  const session: DemoSession = {
    sessionId: newSessionId,
    tenantId: 'demo-tenant',  // shared demo tenant
    agentId,
    apiKey: DEMO_ADMIN_KEY,  // use the shared key
    createdAt: Date.now(),
  };

  sessions.set(newSessionId, session);

  // Clean up old sessions (>1 hour)
  for (const [id, s] of sessions) {
    if (Date.now() - s.createdAt > 3600000) {
      sessions.delete(id);
      // Optionally: delete the agent via API to clean up
    }
  }

  return session;
}
```

### 4. Mock Tools (`lib/demo-tools.ts`)

These tools return **hardcoded mock data** — the governance is real, the business data is fake.

```typescript
export interface ToolResult {
  success: boolean;
  data: string;
}

export const MOCK_ACCOUNTS: Record<string, any> = {
  'A-1234': {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    type: 'Premium',
    balance: '$12,450.00',
    opened: '2023-06-15',
    last_activity: '2026-03-20',
    support_tier: 'Priority',
    pending_cases: 1,
  },
  'A-5678': {
    name: 'Michael Chen',
    email: 'michael.chen@email.com',
    type: 'Standard',
    balance: '$3,200.00',
    opened: '2024-01-10',
    last_activity: '2026-03-19',
    support_tier: 'Standard',
    pending_cases: 0,
  },
};

export const MOCK_KB_ARTICLES: Record<string, string> = {
  'refund': 'Atlas Financial Refund Policy: Customers may request a full refund within 30 days of any transaction. Refunds are processed within 5-7 business days. For transactions over $5,000, manager approval is required. Contact support@atlas.financial for assistance.',
  'transfer': 'Wire Transfer Guide: Domestic transfers take 1-2 business days. International transfers take 3-5 business days. Daily transfer limit is $25,000 for Standard accounts and $100,000 for Premium accounts.',
  'security': 'Account Security: All accounts are protected by 2FA. Suspicious activity triggers automatic account freeze. Contact security@atlas.financial immediately if you suspect unauthorized access.',
  'fees': 'Fee Schedule: Standard accounts: $0/month. Premium accounts: $29.99/month. Wire transfers: $25 domestic, $45 international. Late payment: $35.',
};

export const MOCK_CASES: Record<string, any> = {
  'C-5678': {
    id: 'C-5678',
    customer: 'Sarah Johnson (A-1234)',
    status: 'Open',
    priority: 'High',
    subject: 'Disputed transaction — $1,250 charge on March 15',
    created: '2026-03-18',
    notes: [
      { date: '2026-03-18', author: 'System', text: 'Case created from customer dispute form' },
      { date: '2026-03-19', author: 'Support Agent', text: 'Contacted merchant for transaction details' },
    ],
  },
};

export function searchKnowledgeBase(query: string): ToolResult {
  const queryLower = query.toLowerCase();
  for (const [key, article] of Object.entries(MOCK_KB_ARTICLES)) {
    if (queryLower.includes(key)) {
      return { success: true, data: article };
    }
  }
  return {
    success: true,
    data: `Found 3 articles related to "${query}". The most relevant: Atlas Financial general FAQ — please contact support@atlas.financial for specific inquiries.`,
  };
}

export function lookupAccount(accountId: string): ToolResult {
  const account = MOCK_ACCOUNTS[accountId] ?? MOCK_ACCOUNTS['A-1234'];
  return {
    success: true,
    data: JSON.stringify(account, null, 2),
  };
}

export function sendEmail(to: string, subject: string, body: string): ToolResult {
  return {
    success: true,
    data: `Email sent successfully to ${to}.\nSubject: ${subject}\nBody preview: ${body.substring(0, 100)}...`,
  };
}

export function updateCase(caseId: string, notes: string): ToolResult {
  return {
    success: true,
    data: `Case ${caseId} updated with note: "${notes}". Status remains Open. Timestamp: ${new Date().toISOString()}`,
  };
}

export function exportData(): ToolResult {
  // This should never execute — the policy blocks it
  return { success: false, data: 'Export blocked by policy' };
}

export function closeAccount(): ToolResult {
  // This should never execute — the policy blocks it
  return { success: false, data: 'Account closure blocked by policy' };
}
```

### 5. Chat API Route (`app/api/chat/route.ts`)

This is the streaming chat endpoint using Vercel AI SDK + LangChain with governed tools.

```typescript
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { AgentIdentityClient } from '@sidclaw/sdk';
import { getOrCreateDemoSession } from '@/lib/demo-session';
import {
  searchKnowledgeBase,
  lookupAccount,
  sendEmail,
  updateCase,
} from '@/lib/demo-tools';
import { z } from 'zod';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function POST(request: Request) {
  const { messages, sessionId } = await request.json();

  const session = await getOrCreateDemoSession(sessionId);

  const client = new AgentIdentityClient({
    apiKey: session.apiKey,
    apiUrl: SIDCLAW_API_URL,
    agentId: session.agentId,
  });

  // Define tools with governance wrappers
  const tools = {
    search_knowledge_base: {
      description: 'Search the Atlas Financial internal knowledge base for policy documents, FAQs, and guides. Use this for general questions about refunds, transfers, fees, security.',
      parameters: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async ({ query }: { query: string }) => {
        // Evaluate governance
        const decision = await client.evaluate({
          operation: 'search',
          target_integration: 'knowledge_base',
          resource_scope: 'internal_docs',
          data_classification: 'internal',
          context: { query },
        });

        if (decision.decision === 'deny') {
          return `[BLOCKED BY POLICY] This action was denied: ${decision.reason}`;
        }

        if (decision.decision === 'approval_required') {
          return `[APPROVAL REQUIRED] This action needs human approval before it can proceed. Approval ID: ${decision.approval_request_id}. A reviewer has been notified. Reason: ${decision.reason}`;
        }

        // Allowed — execute the tool
        const result = searchKnowledgeBase(query);
        await client.recordOutcome(decision.trace_id, { status: 'success' });
        return result.data;
      },
    },

    lookup_account: {
      description: 'Look up a customer account by account ID. Returns account details including name, balance, type, and support tier.',
      parameters: z.object({
        account_id: z.string().describe('The account ID (e.g., A-1234)'),
      }),
      execute: async ({ account_id }: { account_id: string }) => {
        const decision = await client.evaluate({
          operation: 'lookup',
          target_integration: 'customer_crm',
          resource_scope: 'customer_records',
          data_classification: 'confidential',
          context: { account_id },
        });

        if (decision.decision === 'deny') {
          return `[BLOCKED BY POLICY] ${decision.reason}`;
        }
        if (decision.decision === 'approval_required') {
          return `[APPROVAL REQUIRED] Looking up this account requires approval. Approval ID: ${decision.approval_request_id}. Reason: ${decision.reason}`;
        }

        const result = lookupAccount(account_id);
        await client.recordOutcome(decision.trace_id, { status: 'success' });
        return result.data;
      },
    },

    send_email: {
      description: 'Send an email to a customer. Use this for follow-ups, notifications, or responses. Requires human approval before sending.',
      parameters: z.object({
        to: z.string().describe('Customer email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body content'),
      }),
      execute: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
        const decision = await client.evaluate({
          operation: 'send_email',
          target_integration: 'email_service',
          resource_scope: 'customer_emails',
          data_classification: 'confidential',
          context: { to, subject, body_preview: body.substring(0, 200) },
        });

        if (decision.decision === 'deny') {
          return `[BLOCKED BY POLICY] ${decision.reason}`;
        }
        if (decision.decision === 'approval_required') {
          // Store the pending action context so we can execute after approval
          return `[APPROVAL REQUIRED] This email requires human review before sending. A reviewer will see the email content and recipient. Approval ID: ${decision.approval_request_id}. Please check the governance panel on the right to approve or deny this action.`;
        }

        const result = sendEmail(to, subject, body);
        await client.recordOutcome(decision.trace_id, { status: 'success' });
        return result.data;
      },
    },

    update_case: {
      description: 'Update a support case with new notes or status changes. Requires human approval for modifications.',
      parameters: z.object({
        case_id: z.string().describe('The case ID (e.g., C-5678)'),
        notes: z.string().describe('Notes to add to the case'),
      }),
      execute: async ({ case_id, notes }: { case_id: string; notes: string }) => {
        const decision = await client.evaluate({
          operation: 'update_case',
          target_integration: 'case_management',
          resource_scope: 'support_cases',
          data_classification: 'confidential',
          context: { case_id, notes_preview: notes.substring(0, 200) },
        });

        if (decision.decision === 'deny') {
          return `[BLOCKED BY POLICY] ${decision.reason}`;
        }
        if (decision.decision === 'approval_required') {
          return `[APPROVAL REQUIRED] Updating case records requires human review. Approval ID: ${decision.approval_request_id}. Please check the governance panel to approve.`;
        }

        const result = updateCase(case_id, notes);
        await client.recordOutcome(decision.trace_id, { status: 'success' });
        return result.data;
      },
    },

    export_customer_data: {
      description: 'Export customer data to a file. This is typically blocked by policy.',
      parameters: z.object({
        format: z.string().describe('Export format (csv, json)'),
        scope: z.string().describe('What data to export'),
      }),
      execute: async ({ format, scope }: { format: string; scope: string }) => {
        const decision = await client.evaluate({
          operation: 'export_data',
          target_integration: 'customer_crm',
          resource_scope: 'customer_pii',
          data_classification: 'restricted',
          context: { format, scope },
        });

        if (decision.decision === 'deny') {
          await client.recordOutcome(decision.trace_id, { status: 'error', metadata: { reason: 'blocked_by_policy' } }).catch(() => {});
          return `[BLOCKED BY POLICY] This action has been denied. Reason: ${decision.reason}. No data was accessed or exported.`;
        }

        // Should not reach here due to deny policy, but handle just in case
        return `[BLOCKED] Export not available.`;
      },
    },

    close_account: {
      description: 'Close a customer account. This is a high-risk action typically blocked by policy.',
      parameters: z.object({
        account_id: z.string().describe('The account ID to close'),
        reason: z.string().describe('Reason for closure'),
      }),
      execute: async ({ account_id, reason }: { account_id: string; reason: string }) => {
        const decision = await client.evaluate({
          operation: 'close_account',
          target_integration: 'customer_crm',
          resource_scope: 'customer_accounts',
          data_classification: 'restricted',
          context: { account_id, reason },
        });

        if (decision.decision === 'deny') {
          await client.recordOutcome(decision.trace_id, { status: 'error', metadata: { reason: 'blocked_by_policy' } }).catch(() => {});
          return `[BLOCKED BY POLICY] Account closure denied. Reason: ${decision.reason}. This action requires direct human processing and cannot be performed by an automated agent.`;
        }

        return `[BLOCKED] Account closure not available.`;
      },
    },
  };

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: `You are the AI support agent for Atlas Financial, a financial services company. You help customers with account inquiries, policy questions, case management, and follow-ups.

You have access to these tools:
- search_knowledge_base: Search internal docs (refunds, transfers, fees, security)
- lookup_account: Look up customer account details by ID
- send_email: Send email to customers (requires approval)
- update_case: Update support case records (requires approval)
- export_customer_data: Export customer data (blocked by policy)
- close_account: Close customer accounts (blocked by policy)

IMPORTANT BEHAVIOR:
- When a tool returns [BLOCKED BY POLICY], explain naturally that this action is not permitted and why. Do NOT retry or try to work around the block.
- When a tool returns [APPROVAL REQUIRED], explain that a human reviewer needs to approve this action, and invite the user to check the governance panel on the right side of the screen to approve or deny.
- When a tool succeeds, present the information naturally.
- Always be helpful and professional. If an action is blocked, suggest alternatives.
- For account lookups, use A-1234 as the default if no account ID is specified.
- For case references, use C-5678 as the default.

You are demonstrating SidClaw's governance platform. The governance decisions you encounter (allow, approval_required, deny) are being made in real-time by the SidClaw policy engine based on actual policy rules configured for Atlas Financial.`,
    messages,
    tools,
    maxSteps: 5,  // allow multi-step tool use
  });

  return result.toDataStreamResponse();
}
```

### 6. Governance Polling API (`app/api/governance/route.ts`)

The governance panel needs to know about new traces and pending approvals. This endpoint returns recent governance activity for the demo session's agent.

```typescript
import { NextRequest, NextResponse } from 'next/server';

const SIDCLAW_API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const apiKey = request.nextUrl.searchParams.get('apiKey');
  const agentId = request.nextUrl.searchParams.get('agentId');
  const since = request.nextUrl.searchParams.get('since');  // ISO timestamp

  if (!apiKey || !agentId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Fetch recent traces for this agent
  const tracesRes = await fetch(
    `${SIDCLAW_API_URL}/api/v1/traces?agent_id=${agentId}&limit=10`,
    { headers }
  );
  const traces = await tracesRes.json();

  // Fetch pending approvals
  const approvalsRes = await fetch(
    `${SIDCLAW_API_URL}/api/v1/approvals?status=pending&agent_id=${agentId}&limit=10`,
    { headers }
  );
  // The approval list endpoint may not support agent_id filter — if not, filter client-side
  const approvals = await approvalsRes.json();

  // For each trace, fetch its events
  const tracesWithEvents = await Promise.all(
    (traces.data ?? []).slice(0, 5).map(async (trace: any) => {
      const detailRes = await fetch(
        `${SIDCLAW_API_URL}/api/v1/traces/${trace.id}`,
        { headers }
      );
      const detail = await detailRes.json();
      return detail;
    })
  );

  // For each pending approval, fetch context
  const approvalsWithContext = await Promise.all(
    (approvals.data ?? [])
      .filter((a: any) => a.agent_id === agentId)
      .map(async (approval: any) => {
        const detailRes = await fetch(
          `${SIDCLAW_API_URL}/api/v1/approvals/${approval.id}`,
          { headers }
        );
        return detailRes.json();
      })
  );

  return NextResponse.json({
    traces: tracesWithEvents,
    pendingApprovals: approvalsWithContext,
    timestamp: new Date().toISOString(),
  });
}
```

### 7. Demo Page (`app/page.tsx`)

```tsx
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
    // Initialize demo session
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
        <ChatInterface sessionId={sessionId!} />
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
```

### 8. Demo Layout (`components/DemoLayout.tsx`)

```tsx
export function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {children}
    </div>
  );
}
```

The two children (ChatInterface and GovernancePanel) each take 50% width.

### 9. Chat Interface (`components/ChatInterface.tsx`)

```tsx
'use client';

import { useChat } from 'ai/react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { SuggestedPrompts } from './SuggestedPrompts';

interface ChatInterfaceProps {
  sessionId: string;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    body: { sessionId },
  });

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
            <p className="text-sm text-[#A1A1AA]">Hello! I'm the Atlas Financial support agent.</p>
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
      </div>

      {/* Suggested prompts (show after first response) */}
      {messages.length > 0 && messages.length < 4 && (
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
```

### 10. Chat Message (`components/ChatMessage.tsx`)

```tsx
interface ChatMessageProps {
  message: { role: string; content: string };
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  // Detect governance annotations in the message
  const hasBlocked = message.content.includes('[BLOCKED BY POLICY]');
  const hasApproval = message.content.includes('[APPROVAL REQUIRED]');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-[#3B82F6] text-white'
            : hasBlocked
            ? 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#E4E4E7]'
            : hasApproval
            ? 'bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#E4E4E7]'
            : 'bg-[#111113] border border-[#2A2A2E] text-[#E4E4E7]'
        }`}
      >
        {/* Render governance badges inline */}
        {hasBlocked && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-[#EF4444]/20 px-2 py-0.5 text-xs font-medium text-[#EF4444]">
              BLOCKED BY POLICY
            </span>
          </div>
        )}
        {hasApproval && (
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-[#F59E0B]/20 px-2 py-0.5 text-xs font-medium text-[#F59E0B]">
              APPROVAL REQUIRED
            </span>
            <span className="text-xs text-[#71717A]">Check the panel on the right →</span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{
          message.content
            .replace('[BLOCKED BY POLICY] ', '')
            .replace('[APPROVAL REQUIRED] ', '')
        }</div>
      </div>
    </div>
  );
}
```

### 11. Suggested Prompts (`components/SuggestedPrompts.tsx`)

```tsx
interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  compact?: boolean;
}

const PROMPTS = [
  { label: '✅ Look up my account', prompt: 'Can you look up account A-1234?', effect: 'Allowed instantly' },
  { label: '✅ What\'s the refund policy?', prompt: 'What is the refund policy?', effect: 'Knowledge base search — allowed' },
  { label: '⏳ Send a follow-up email', prompt: 'Send a follow-up email to Sarah Johnson about her disputed transaction', effect: 'Requires YOUR approval' },
  { label: '⏳ Update case notes', prompt: 'Update case C-5678 with notes: merchant confirmed the charge is valid', effect: 'Requires approval' },
  { label: '❌ Export customer data', prompt: 'Export all customer data to a CSV file', effect: 'Blocked by policy' },
  { label: '❌ Close an account', prompt: 'Close account A-1234', effect: 'Blocked — too high risk' },
];

export function SuggestedPrompts({ onSelect, compact }: SuggestedPromptsProps) {
  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p.prompt}
            onClick={() => onSelect(p.prompt)}
            className="rounded-full border border-[#2A2A2E] bg-[#111113] px-3 py-1 text-xs text-[#A1A1AA] hover:border-[#3B82F6]/50 hover:text-[#E4E4E7] transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wider text-[#71717A]">Try these scenarios</p>
      {PROMPTS.map((p) => (
        <button
          key={p.prompt}
          onClick={() => onSelect(p.prompt)}
          className="w-full rounded-lg border border-[#2A2A2E] bg-[#111113] px-4 py-3 text-left transition-colors hover:border-[#3B82F6]/50"
        >
          <div className="text-sm text-[#E4E4E7]">{p.label}</div>
          <div className="mt-0.5 text-xs text-[#71717A]">{p.effect}</div>
        </button>
      ))}
    </div>
  );
}
```

### 12. Governance Panel (`components/GovernancePanel.tsx`)

This is the right side — shows real-time governance activity by polling the API.

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { GovernanceEvent } from './GovernanceEvent';
import { ApprovalCard } from './ApprovalCard';

interface GovernancePanelProps {
  sessionId: string;
  agentId: string;
  apiKey: string;
}

interface TraceData {
  id: string;
  requested_operation: string;
  target_integration: string;
  final_outcome: string;
  started_at: string;
  events: Array<{
    event_type: string;
    actor_name: string;
    description: string;
    timestamp: string;
    status: string;
  }>;
}

interface ApprovalData {
  id: string;
  trace_id: string;
  requested_operation: string;
  target_integration: string;
  flag_reason: string;
  status: string;
  risk_classification: string | null;
  context_snapshot: Record<string, unknown> | null;
  agent: { name: string; owner_name: string };
  policy_rule: { policy_name: string; rationale: string };
  trace_events: Array<any>;
}

export function GovernancePanel({ sessionId, agentId, apiKey }: GovernancePanelProps) {
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/governance?agentId=${agentId}&apiKey=${apiKey}&since=${lastUpdate}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setTraces(data.traces ?? []);
      setPendingApprovals(data.pendingApprovals ?? []);
      setLastUpdate(data.timestamp);
    } catch {
      // Silent fail on poll errors
    }
  }, [agentId, apiKey, lastUpdate]);

  useEffect(() => {
    poll(); // Initial fetch
    const interval = setInterval(poll, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [poll]);

  const handleApprove = async (approvalId: string, note: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_SIDCLAW_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${approvalId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approver_name: 'Demo Reviewer',
        decision_note: note || 'Approved via interactive demo',
      }),
    });
    // Refresh immediately
    await poll();
  };

  const handleDeny = async (approvalId: string, note: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_SIDCLAW_API_URL ?? 'http://localhost:4000'}/api/v1/approvals/${approvalId}/deny`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        approver_name: 'Demo Reviewer',
        decision_note: note || 'Denied via interactive demo',
      }),
    });
    await poll();
  };

  return (
    <div className="flex w-1/2 flex-col">
      {/* Header */}
      <div className="border-b border-[#2A2A2E] px-6 py-4">
        <h2 className="text-base font-medium text-[#E4E4E7]">Governance Activity</h2>
        <p className="mt-1 text-xs text-[#71717A]">
          Real-time policy decisions from SidClaw • {traces.length} trace{traces.length !== 1 ? 's' : ''} • {pendingApprovals.length} pending
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {traces.length === 0 && pendingApprovals.length === 0 && (
          <div className="mt-8 text-center text-sm text-[#71717A]">
            <p>Governance events will appear here as you interact with the agent.</p>
            <p className="mt-2">Try asking the agent to do something →</p>
          </div>
        )}

        {/* Pending approvals first (most important) */}
        {pendingApprovals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            onApprove={(note) => handleApprove(approval.id, note)}
            onDeny={(note) => handleDeny(approval.id, note)}
          />
        ))}

        {/* Recent traces */}
        {traces.map((trace) => (
          <GovernanceEvent key={trace.id} trace={trace} />
        ))}
      </div>

      {/* Footer links */}
      <div className="border-t border-[#2A2A2E] px-6 py-3 flex items-center justify-between">
        <span className="text-xs text-[#71717A]">Atlas Financial — Demo Environment</span>
        <div className="flex gap-4">
          <a href="https://app.sidclaw.com" target="_blank" className="text-xs text-[#3B82F6] hover:underline">
            Open Full Dashboard →
          </a>
          <a href="https://docs.sidclaw.com" target="_blank" className="text-xs text-[#3B82F6] hover:underline">
            Documentation →
          </a>
        </div>
      </div>
    </div>
  );
}
```

### 13. Approval Card (`components/ApprovalCard.tsx`)

This is the key component — it's what creates the "wow" moment.

```tsx
'use client';

import { useState } from 'react';

interface ApprovalCardProps {
  approval: {
    id: string;
    requested_operation: string;
    target_integration: string;
    flag_reason: string;
    risk_classification: string | null;
    context_snapshot: Record<string, unknown> | null;
    policy_rule: { policy_name: string; rationale: string };
  };
  onApprove: (note: string) => void;
  onDeny: (note: string) => void;
}

export function ApprovalCard({ approval, onApprove, onDeny }: ApprovalCardProps) {
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const riskColors: Record<string, string> = {
    low: 'bg-[#71717A]/20 text-[#71717A]',
    medium: 'bg-[#3B82F6]/20 text-[#3B82F6]',
    high: 'bg-[#F59E0B]/20 text-[#F59E0B]',
    critical: 'bg-[#EF4444]/20 text-[#EF4444]',
  };

  return (
    <div className="rounded-lg border border-[#F59E0B]/30 bg-[#111113] overflow-hidden animate-in slide-in-from-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#F59E0B]/20 px-2 py-0.5 text-xs font-medium text-[#F59E0B]">
            APPROVAL REQUIRED
          </span>
          {approval.risk_classification && (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${riskColors[approval.risk_classification] ?? riskColors.medium}`}>
              {approval.risk_classification.toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-xs text-[#71717A]">Just now</span>
      </div>

      {/* Action */}
      <div className="px-4 py-3">
        <div className="font-mono text-sm text-[#E4E4E7]">
          {approval.requested_operation} → {approval.target_integration}
        </div>
      </div>

      {/* Why This Was Flagged */}
      <div className="mx-4 mb-3 rounded border-l-4 border-[#F59E0B] bg-[#1A1A1D] px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-[#F59E0B] mb-1">
          Why This Was Flagged
        </div>
        <div className="text-sm text-[#A1A1AA]">
          {approval.policy_rule.rationale}
        </div>
        <div className="mt-1 text-xs text-[#71717A]">
          Policy: {approval.policy_rule.policy_name}
        </div>
      </div>

      {/* Context */}
      {approval.context_snapshot && Object.keys(approval.context_snapshot).length > 0 && (
        <div className="mx-4 mb-3 rounded bg-[#1A1A1D] px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-1">
            Agent Context
          </div>
          <pre className="text-xs text-[#A1A1AA] font-mono whitespace-pre-wrap">
            {JSON.stringify(approval.context_snapshot, null, 2)}
          </pre>
        </div>
      )}

      {/* Reviewer Action */}
      <div className="px-4 pb-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          className="w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder-[#71717A] focus:border-[#3B82F6] focus:outline-none resize-none"
          rows={2}
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => { setActing(true); onApprove(note); }}
            disabled={acting}
            className="flex-1 rounded bg-[#22C55E]/80 px-4 py-2 text-sm font-medium text-white hover:bg-[#22C55E] disabled:opacity-50 transition-colors"
          >
            {acting ? 'Processing...' : 'Approve'}
          </button>
          <button
            onClick={() => { setActing(true); onDeny(note); }}
            disabled={acting}
            className="flex-1 rounded bg-[#EF4444]/80 px-4 py-2 text-sm font-medium text-white hover:bg-[#EF4444] disabled:opacity-50 transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 14. Governance Event (`components/GovernanceEvent.tsx`)

Shows a completed trace as a compact card.

```tsx
interface GovernanceEventProps {
  trace: {
    id: string;
    requested_operation: string;
    target_integration: string;
    final_outcome: string;
    started_at: string;
    events: Array<{
      event_type: string;
      actor_name: string;
      description: string;
      timestamp: string;
    }>;
  };
}

export function GovernanceEvent({ trace }: GovernanceEventProps) {
  const [expanded, setExpanded] = useState(false);

  const outcomeStyles: Record<string, { bg: string; text: string; label: string }> = {
    executed: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'ALLOWED' },
    completed_with_approval: { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', label: 'APPROVED' },
    blocked: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'BLOCKED' },
    denied: { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', label: 'DENIED' },
    in_progress: { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', label: 'IN PROGRESS' },
    expired: { bg: 'bg-[#71717A]/10', text: 'text-[#71717A]', label: 'EXPIRED' },
  };

  const style = outcomeStyles[trace.final_outcome] ?? outcomeStyles.in_progress;

  const timeDiff = () => {
    const seconds = Math.floor((Date.now() - new Date(trace.started_at).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div
      className={`rounded-lg border border-[#2A2A2E] bg-[#111113] overflow-hidden cursor-pointer transition-colors hover:border-[#3B82F6]/30`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
            {style.label}
          </span>
          <span className="font-mono text-sm text-[#E4E4E7]">
            {trace.requested_operation}
          </span>
          <span className="text-xs text-[#71717A]">→ {trace.target_integration}</span>
        </div>
        <span className="text-xs text-[#71717A]">{timeDiff()}</span>
      </div>

      {expanded && trace.events && (
        <div className="border-t border-[#2A2A2E] px-4 py-3">
          <div className="space-y-2">
            {trace.events.map((event, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#71717A] flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-[#A1A1AA]">{event.event_type}</span>
                  <span className="ml-2 text-xs text-[#71717A]">{event.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 15. Chat Input (`components/ChatInput.tsx`)

```tsx
interface ChatInputProps {
  input: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ input, onChange, onSubmit, isLoading }: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="border-t border-[#2A2A2E] px-6 py-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={onChange}
          placeholder="Ask the Atlas Financial support agent..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-[#2A2A2E] bg-[#111113] px-4 py-2.5 text-sm text-[#E4E4E7] placeholder-[#71717A] focus:border-[#3B82F6] focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-[#3B82F6] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#3B82F6]/90 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </form>
  );
}
```

### 16. Demo Header (`components/DemoHeader.tsx`)

```tsx
export function DemoHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[#2A2A2E] px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-[#E4E4E7]">SidClaw</span>
        <span className="rounded bg-[#3B82F6]/10 px-2 py-0.5 text-xs font-medium text-[#3B82F6]">
          Interactive Demo
        </span>
      </div>
      <div className="flex items-center gap-4">
        <a href="https://docs.sidclaw.com" target="_blank" className="text-xs text-[#A1A1AA] hover:text-[#E4E4E7]">
          Docs
        </a>
        <a href="https://github.com/sidclawhq/platform" target="_blank" className="text-xs text-[#A1A1AA] hover:text-[#E4E4E7]">
          GitHub
        </a>
        <a href="https://app.sidclaw.com/signup" className="rounded bg-[#3B82F6] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#3B82F6]/90">
          Get Started Free
        </a>
      </div>
    </header>
  );
}
```

### 17. Demo Footer (`components/DemoFooter.tsx`)

```tsx
export function DemoFooter() {
  return (
    <footer className="border-t border-[#2A2A2E] px-6 py-3 flex items-center justify-between">
      <div className="text-xs text-[#71717A]">
        This demo uses <span className="text-[#A1A1AA]">real SidClaw governance</span> — the policy evaluation, approval workflow, and audit traces are 100% authentic.
        Only the business data (accounts, emails) is simulated.
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-[#71717A]">Ready to govern your agents?</span>
        <a href="https://app.sidclaw.com/signup" className="rounded bg-[#22C55E]/80 px-4 py-1.5 text-xs font-medium text-white hover:bg-[#22C55E]">
          Start Free →
        </a>
      </div>
    </footer>
  );
}
```

### 18. Setup API Route (`app/api/setup/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { getOrCreateDemoSession } from '@/lib/demo-session';

export async function POST() {
  try {
    const session = await getOrCreateDemoSession(null);
    return NextResponse.json({
      sessionId: session.sessionId,
      agentId: session.agentId,
      apiKey: session.apiKey,
    });
  } catch (error) {
    console.error('Demo setup failed:', error);
    return NextResponse.json(
      { error: 'Failed to set up demo environment' },
      { status: 500 }
    );
  }
}
```

### 19. Environment Variables

Create `apps/demo/.env.local`:

```
SIDCLAW_API_URL=http://localhost:4000
DEMO_ADMIN_API_KEY=<key from deployment/.env.development>
NEXT_PUBLIC_SIDCLAW_API_URL=http://localhost:4000
ANTHROPIC_API_KEY=<your anthropic API key>
```

For production:
```
SIDCLAW_API_URL=https://api.sidclaw.com
DEMO_ADMIN_API_KEY=<production admin key>
NEXT_PUBLIC_SIDCLAW_API_URL=https://api.sidclaw.com
ANTHROPIC_API_KEY=<production key>
```

### 20. Package.json

```json
{
  "name": "@sidclaw/demo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3003",
    "build": "next build",
    "start": "next start --port 3003"
  }
}
```

### 21. Next.js Config

```typescript
// apps/demo/next.config.ts
const nextConfig = {
  output: 'standalone',
  // Allow API calls to SidClaw API
  async rewrites() {
    return [];  // Direct API calls, no rewrites needed
  },
};
export default nextConfig;
```

### 22. Design Requirements

- **Same "Institutional Calm" aesthetic** as the rest of the product
- Background: `#0A0A0B`
- Text primary: `#E4E4E7`, secondary: `#A1A1AA`, muted: `#71717A`
- Surface layers: `#111113`, `#1A1A1D`
- Borders: `#2A2A2E`
- Approval cards: amber border `#F59E0B`
- Blocked messages: red tint `#EF4444`
- Allowed: green `#22C55E`
- Info/buttons: blue `#3B82F6`
- Fonts: Inter for body, JetBrains Mono for operations/trace IDs
- No gradients, no AI sparkle, no decorative elements
- The governance panel should feel like a condensed version of the real dashboard — professional, information-rich, trustworthy

### 23. Animations

Add subtle animations for governance events appearing:

```css
@keyframes slide-in-from-right {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.animate-in {
  animation: slide-in-from-right 0.3s ease-out;
}
```

Apply to new governance events and approval cards as they appear.

## Acceptance Criteria

- [ ] Demo page loads at `localhost:3003` with split-screen layout
- [ ] Chat interface works with streaming responses from Claude
- [ ] Typing "What's the refund policy?" → agent responds instantly, governance panel shows ALLOWED trace
- [ ] Typing "Look up account A-1234" → agent shows account details, governance panel shows ALLOWED
- [ ] Typing "Send a follow-up email to Sarah" → agent pauses, governance panel shows APPROVAL REQUIRED card with amber styling, "Why This Was Flagged" section, and Approve/Deny buttons
- [ ] Clicking Approve on the card → agent continues, governance panel shows APPROVED trace with full event chain
- [ ] Typing "Export all customer data" → agent says it's blocked, governance panel shows BLOCKED trace in red
- [ ] Typing "Close account A-1234" → same blocking behavior
- [ ] Suggested prompts guide the user through all 3 effects
- [ ] Governance panel polls every 2 seconds and updates in real-time
- [ ] Approval card shows: policy rationale, agent context, risk badge, reviewer note field
- [ ] Governance events expand on click to show the trace timeline
- [ ] "Get Started Free" and "Open Full Dashboard" links work
- [ ] "Institutional Calm" aesthetic maintained throughout
- [ ] Each demo session gets an isolated agent (sessions don't interfere)
- [ ] Old sessions cleaned up after 1 hour
- [ ] No hardcoded API keys in client-side code
- [ ] `turbo build` succeeds

## Constraints

- Do NOT modify the SidClaw API, SDK, or dashboard
- Do NOT store real customer data — all business data is mock/hardcoded
- The governance layer (policy evaluation, traces, approvals) MUST be real SidClaw API calls
- The LLM (Claude) must be used for natural chat — do NOT hardcode agent responses
- Keep the demo app self-contained in `apps/demo/`
- Follow code style: files in `kebab-case.tsx`, components in `PascalCase`
