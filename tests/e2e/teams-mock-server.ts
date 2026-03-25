/**
 * Mock Microsoft Teams server for E2E testing.
 * Captures incoming webhook calls and Bot Framework API calls.
 */

import Fastify from 'fastify';

export interface CapturedMessage {
  type: string;
  attachments: Array<{
    contentType: string;
    content: Record<string, unknown>;
  }>;
}

export function createMockTeamsServer() {
  const app = Fastify();
  const messages: CapturedMessage[] = [];

  // Incoming webhook endpoint — receives Adaptive Cards
  app.post('/webhook/incoming', async (request, reply) => {
    const body = request.body as CapturedMessage;
    messages.push(body);
    return reply.send({ ok: true });
  });

  // Bot Framework update activity endpoint (for message updates after decision)
  app.put('/v3/conversations/:conversationId/activities/:activityId', async (request, reply) => {
    const body = request.body as CapturedMessage;
    messages.push(body);
    return reply.send({ id: 'updated-activity-id' });
  });

  return {
    app,
    messages,
    reset() {
      messages.length = 0;
    },
  };
}
