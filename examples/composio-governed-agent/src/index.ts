#!/usr/bin/env tsx
/**
 * Composio Governed Agent — SidClaw + Composio Integration Example
 *
 * Demonstrates governing Composio tool execution with SidClaw policies.
 * Three tools, three different policy outcomes:
 *   - GITHUB_CREATE_ISSUE   -> allowed (internal data, safe)
 *   - GMAIL_SEND_EMAIL      -> approval_required (outbound customer contact)
 *   - SALESFORCE_QUERY_LEADS -> denied (restricted CRM data)
 *
 * This example uses a mock Composio client (no real API key needed).
 * In production, replace MockComposio with the real @composio/core client.
 *
 * Usage:
 *   SIDCLAW_API_KEY=<key> npx tsx src/index.ts github
 *   SIDCLAW_API_KEY=<key> npx tsx src/index.ts gmail
 *   SIDCLAW_API_KEY=<key> npx tsx src/index.ts salesforce
 */

import { AgentIdentityClient, ActionDeniedError, ApprovalTimeoutError } from '@sidclaw/sdk';
import { governComposioExecution } from '@sidclaw/sdk/composio';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY = process.env.SIDCLAW_API_KEY;
const API_URL = process.env.SIDCLAW_API_URL ?? 'http://localhost:4000';
const AGENT_ID = process.env.AGENT_ID ?? 'composio-agent';

if (!API_KEY) {
  console.error('Error: SIDCLAW_API_KEY environment variable is required.');
  console.error('Find it in deployment/.env.development (created by prisma db seed).');
  process.exit(1);
}

const scenario = process.argv[2];
if (!scenario || !['github', 'gmail', 'salesforce'].includes(scenario)) {
  console.error('Usage: npx tsx src/index.ts <scenario>');
  console.error('');
  console.error('Scenarios:');
  console.error('  github     - Create a GitHub issue (expected: ALLOW)');
  console.error('  gmail      - Send an email (expected: APPROVAL REQUIRED)');
  console.error('  salesforce - Query Salesforce leads (expected: DENY)');
  process.exit(1);
}

const SEPARATOR = '\u2500'.repeat(60);

// ---------------------------------------------------------------------------
// Mock Composio client (replace with real @composio/core in production)
// ---------------------------------------------------------------------------

const mockComposio = {
  tools: {
    execute: async (slug: string, params: Record<string, unknown>) => {
      console.log(`  [Composio] Executing ${slug}...`);
      // Simulate Composio tool execution
      return {
        data: {
          status: 'completed',
          slug,
          message: `Successfully executed ${slug}`,
        },
        error: null,
        successful: true,
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Set up governed execution
// ---------------------------------------------------------------------------

const sidclaw = new AgentIdentityClient({
  apiKey: API_KEY,
  apiUrl: API_URL,
  agentId: AGENT_ID,
});

const execute = governComposioExecution(sidclaw, mockComposio, {
  dataClassification: {
    SALESFORCE: 'restricted',
    GITHUB: 'internal',
    GMAIL: 'confidential',
  },
  defaultClassification: 'internal',
  waitForApproval: false, // Don't block — show the approval_required outcome
});

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

const scenarios: Record<string, { slug: string; params: Record<string, unknown> }> = {
  github: {
    slug: 'GITHUB_CREATE_ISSUE',
    params: {
      userId: 'user_123',
      arguments: {
        owner: 'acme-corp',
        repo: 'backend',
        title: 'Fix login timeout bug',
        body: 'Users report intermittent login timeouts under load.',
      },
    },
  },
  gmail: {
    slug: 'GMAIL_SEND_EMAIL',
    params: {
      userId: 'user_123',
      arguments: {
        to: 'customer@example.com',
        subject: 'Your Support Ticket Update',
        body: 'Hi, your issue has been resolved. Please let us know if you need anything else.',
      },
    },
  },
  salesforce: {
    slug: 'SALESFORCE_QUERY_LEADS',
    params: {
      userId: 'user_123',
      arguments: {
        query: 'SELECT Id, Name, Email FROM Lead WHERE Status = "Open"',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  const { slug, params } = scenarios[scenario];

  console.log(`${SEPARATOR}`);
  console.log('  SidClaw + Composio Governed Agent');
  console.log(`${SEPARATOR}`);
  console.log(`  Scenario: ${scenario}`);
  console.log(`  Tool: ${slug}`);
  console.log(`  Params: ${JSON.stringify(params.arguments ?? {})}`);
  console.log('');

  try {
    console.log('  Evaluating governance policy...');
    const { result, traceId, decision } = await execute(slug, params);

    console.log('');
    console.log(`  Decision: ${decision.toUpperCase()}`);
    console.log(`  Trace ID: ${traceId}`);
    console.log(`  Result: ${JSON.stringify(result)}`);
    console.log('');
    console.log('  Check the dashboard at http://localhost:3000/dashboard/audit');
  } catch (error) {
    if (error instanceof ActionDeniedError) {
      console.log('');
      console.log(`  BLOCKED: ${error.reason}`);
      console.log(`  Trace ID: ${error.traceId}`);

      if (error.message.includes('Approval required')) {
        console.log('');
        console.log('  This action requires human approval.');
        console.log('  A reviewer must approve it in the SidClaw dashboard before it can execute.');
        console.log('  Dashboard: http://localhost:3000/dashboard/approvals');
      } else {
        console.log('');
        console.log('  The policy engine denied this action.');
        console.log('  Dashboard: http://localhost:3000/dashboard/audit');
      }
    } else if (error instanceof ApprovalTimeoutError) {
      console.log('');
      console.log('  TIMEOUT: Approval not received in time.');
    } else {
      throw error;
    }
  }

  console.log(`\n${SEPARATOR}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
