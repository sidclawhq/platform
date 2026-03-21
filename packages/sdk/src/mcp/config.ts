import type { DataClassification } from '@sidclaw/shared';
import type { AgentIdentityClient } from '../client/agent-identity-client.js';

export interface GovernanceMCPServerConfig {
  /** AgentIdentityClient instance for policy evaluation. */
  client: AgentIdentityClient;
  /** Upstream MCP server connection settings. */
  upstream: {
    transport: 'stdio' | 'sse' | 'streamable-http';
    /** Command to start the upstream server (required for stdio). */
    command?: string;
    /** Arguments for the upstream server command. */
    args?: string[];
    /** URL of the upstream server (for sse/streamable-http). */
    url?: string;
  };
  /** Tool-specific governance overrides. */
  toolMappings?: ToolMapping[];
  /** Default data classification when no mapping exists (default: 'internal'). */
  defaultDataClassification?: DataClassification;
  /** Default resource scope when no mapping exists (default: '*'). */
  defaultResourceScope?: string;
  /** How to handle approval_required: 'error' returns immediately, 'block' waits (default: 'error'). */
  approvalWaitMode?: 'error' | 'block';
  /** Max wait time in ms when approvalWaitMode is 'block' (default: 30000). */
  approvalBlockTimeoutMs?: number;
}

export interface ToolMapping {
  /** Tool name to match. Supports glob patterns: "db_*", "*_query". */
  toolName: string;
  /** Override the operation name sent to the policy engine. */
  operation?: string;
  /** Override the target integration name. */
  target_integration?: string;
  /** Override the resource scope. */
  resource_scope?: string;
  /** Override the data classification. */
  data_classification?: DataClassification;
  /** If true, forward this tool without governance evaluation. */
  skip_governance?: boolean;
}
