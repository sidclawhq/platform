#!/usr/bin/env tsx
import { AgentIdentityClient, GovernanceMCPServer } from '@sidclaw/sdk';

const client = new AgentIdentityClient({
  apiKey: process.env.SIDCLAW_API_KEY!,
  apiUrl: process.env.SIDCLAW_API_URL ?? 'http://localhost:4000',
  agentId: process.env.AGENT_ID ?? 'postgres-agent',
});

const server = new GovernanceMCPServer({
  client,
  upstream: {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', process.env.DATABASE_URL!],
  },
  toolMappings: [
    {
      toolName: 'query',
      operation: 'database_query',
      target_integration: 'postgres',
      data_classification: 'confidential',
    },
    {
      toolName: 'list_tables',
      skip_governance: true,
    },
  ],
});

console.log('Starting governed MCP PostgreSQL server...');
console.log('All queries are evaluated against governance policies.');
console.log('Open the dashboard at http://localhost:3000 to see approval requests and traces.');
await server.start();
