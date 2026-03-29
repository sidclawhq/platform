import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://docs.sidclaw.com';

  const docPages = [
    'quickstart',
    'concepts/identity', 'concepts/policy', 'concepts/approval', 'concepts/traces',
    'sdk/installation', 'sdk/client', 'sdk/python', 'sdk/create-sidclaw-app',
    'sdk/evaluate', 'sdk/with-governance', 'sdk/wait-for-approval', 'sdk/record-outcome', 'sdk/errors',
    'integrations/mcp', 'integrations/claude-agent-sdk', 'integrations/google-adk',
    'integrations/composio', 'integrations/llamaindex', 'integrations/copilot-studio',
    'integrations/github-copilot', 'integrations/openclaw', 'integrations/langchain',
    'integrations/openai-agents', 'integrations/crewai', 'integrations/pydantic-ai',
    'integrations/vercel-ai', 'integrations/github-action',
    'integrations/slack', 'integrations/telegram', 'integrations/teams', 'integrations/resend',
    'platform/agents', 'platform/policies', 'platform/policy-design-guide',
    'platform/approvals', 'platform/audit',
    'enterprise/self-hosting', 'enterprise/sso', 'enterprise/rbac',
    'enterprise/api-keys', 'enterprise/webhooks', 'enterprise/chat-integrations',
    'enterprise/siem-export',
    'compliance/finra-2026', 'compliance/eu-ai-act', 'compliance/finma', 'compliance/nist-ai-rmf',
    'api-reference', 'api-reference/evaluate', 'api-reference/agents',
    'api-reference/policies', 'api-reference/approvals', 'api-reference/traces',
    'api-reference/webhooks', 'api-reference/auth', 'api-reference/api-keys',
  ];

  return [
    { url: `${baseUrl}/docs/quickstart`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...docPages.slice(1).map((page) => ({
      url: `${baseUrl}/docs/${page}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
