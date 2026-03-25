/**
 * Mock Composio server for E2E testing.
 *
 * Mimics Composio's tool execution API at /api/v3/tools/execute/:slug.
 * Tracks which tools were called so tests can verify governance outcomes.
 */

import Fastify from 'fastify';

export interface ExecutedTool {
  slug: string;
  arguments: unknown;
  timestamp: string;
}

export function createMockComposioServer() {
  const app = Fastify({ logger: false });
  const executedTools: ExecutedTool[] = [];

  app.post<{
    Params: { slug: string };
    Body: { userId?: string; arguments?: unknown };
  }>('/api/v3/tools/execute/:slug', async (request, reply) => {
    const { slug } = request.params;
    const body = request.body ?? {};

    executedTools.push({
      slug,
      arguments: body.arguments ?? {},
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        status: 'completed',
        slug,
        message: `Successfully executed ${slug}`,
      },
      error: null,
      successful: true,
    };
  });

  return { app, executedTools };
}
