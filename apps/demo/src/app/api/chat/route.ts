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
  const { messages, sessionId, agentId: clientAgentId, apiKey: clientApiKey } = await request.json();

  // Prefer client-provided agentId/apiKey (resilient to dev server restarts clearing in-memory session store)
  let agentId = clientAgentId;
  let apiKey = clientApiKey;

  if (!agentId || !apiKey) {
    const session = await getOrCreateDemoSession(sessionId);
    agentId = session.agentId;
    apiKey = session.apiKey;
  }

  const client = new AgentIdentityClient({
    apiKey,
    apiUrl: SIDCLAW_API_URL,
    agentId,
  });

  const tools = {
    search_knowledge_base: {
      description: 'Search the Atlas Financial internal knowledge base for policy documents, FAQs, and guides. Use this for general questions about refunds, transfers, fees, security.',
      parameters: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async ({ query }: { query: string }) => {
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

CRITICAL RULES:
- You MUST ALWAYS call the relevant tool for EVERY user request — even if you expect it will be blocked. NEVER skip a tool call or answer from memory. Every action must go through the governance system so it appears on the governance panel.
- When a tool returns [BLOCKED BY POLICY], explain naturally that this action is not permitted and why. Do NOT retry or try to work around the block.
- When a tool returns [APPROVAL REQUIRED], explain that a human reviewer needs to approve this action, and invite the user to check the governance panel on the right side of the screen to approve or deny.
- When a tool succeeds, present the information naturally.
- Always be helpful and professional. If an action is blocked, suggest alternatives.
- For account lookups, use A-1234 as the default if no account ID is specified.
- For case references, use C-5678 as the default.

You are demonstrating SidClaw's governance platform. The governance decisions you encounter (allow, approval_required, deny) are being made in real-time by the SidClaw policy engine based on actual policy rules configured for Atlas Financial. It is essential that every action goes through the tools so the governance trace appears on the right panel.`,
    messages,
    tools,
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
