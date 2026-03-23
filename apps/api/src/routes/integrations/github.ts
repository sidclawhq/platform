import { FastifyInstance } from 'fastify';
import { createHmac, timingSafeEqual, createSign } from 'crypto';
import { ApprovalService } from '../../services/approval-service.js';
import { prisma } from '../../db/client.js';

/**
 * Generate a JWT for GitHub App authentication.
 * GitHub Apps authenticate as the app itself using a JWT signed with the app's private key.
 */
function generateAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iat: now - 60,
    exp: now + (10 * 60),
    iss: appId,
  })).toString('base64url');

  const signature = createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(privateKey, 'base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Get an installation access token from GitHub using the App JWT.
 */
async function getInstallationToken(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set');
  }

  const jwt = generateAppJwt(appId, privateKey.replace(/\\n/g, '\n'));

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SidClaw-Governance-App',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.status}`);
  }

  const data = await response.json() as { token: string };
  return data.token;
}

/**
 * Update a GitHub Check Run via the REST API.
 */
async function updateCheckRun(
  token: string,
  owner: string,
  repo: string,
  checkRunId: number,
  update: {
    status: string;
    conclusion?: string;
    output?: { title: string; summary: string };
  },
): Promise<void> {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkRunId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'SidClaw-Governance-App',
      },
      body: JSON.stringify(update),
    },
  );
}

export async function githubAppRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/integrations/github/webhook
   * Receives GitHub webhook events for the SidClaw GitHub App.
   * Handles check_run.requested_action: user clicked "Approve" or "Deny" on a check run.
   */
  app.post('/integrations/github/webhook', async (request, reply) => {
    // 1. Verify GitHub webhook signature (fail-closed: reject if secret is configured but signature is missing/invalid)
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (request as unknown as Record<string, unknown>).rawBody as string | undefined;
    const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

    if (webhookSecret) {
      if (!signature || !rawBody) {
        return reply.status(403).send({ error: 'Missing webhook signature' });
      }
      const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      try {
        if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
          return reply.status(403).send({ error: 'Invalid webhook signature' });
        }
      } catch {
        return reply.status(403).send({ error: 'Invalid webhook signature' });
      }
    }

    const event = request.headers['x-github-event'] as string;
    const payload = request.body as Record<string, unknown>;

    // 2. Handle check_run requested_action (user clicked Approve/Deny button)
    if (event === 'check_run' && payload.action === 'requested_action') {
      const p = payload as Record<string, Record<string, unknown>>;
      const actionId = (p.requested_action as Record<string, unknown> | undefined)?.identifier as string | undefined;
      const checkRunId = (p.check_run as Record<string, unknown> | undefined)?.id as number | undefined;
      const externalId = (p.check_run as Record<string, unknown> | undefined)?.external_id as string | undefined;

      if (!externalId || !actionId || !checkRunId) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      // Look up the approval request
      const approval = await prisma.approvalRequest.findFirst({
        where: { id: externalId },
      });

      if (!approval) {
        return reply.status(404).send({ error: 'Approval request not found' });
      }

      const approvalService = new ApprovalService(prisma);
      const actorName = (p.sender as Record<string, unknown> | undefined)?.login as string ?? 'GitHub User';

      try {
        if (actionId === 'approve') {
          await approvalService.approve(externalId, {
            approver_name: actorName,
            decision_note: 'Approved via GitHub Check Run',
          });
        } else if (actionId === 'deny') {
          await approvalService.deny(externalId, {
            approver_name: actorName,
            decision_note: 'Denied via GitHub Check Run',
          });
        } else {
          return reply.status(400).send({ error: `Unknown action: ${actionId}` });
        }

        // Update the check run to reflect the decision
        const installationId = (p.installation as Record<string, unknown> | undefined)?.id as number | undefined;
        if (installationId) {
          try {
            const token = await getInstallationToken(installationId);
            const repoObj = p.repository as Record<string, unknown> | undefined;
            const owner = (repoObj?.owner as Record<string, unknown> | undefined)?.login as string;
            const repo = repoObj?.name as string;
            const decision = actionId === 'approve' ? 'approved' : 'denied';

            await updateCheckRun(token, owner, repo, checkRunId, {
              status: 'completed',
              conclusion: decision === 'approved' ? 'success' : 'failure',
              output: {
                title: `${decision === 'approved' ? 'Approved' : 'Denied'} by ${actorName}`,
                summary: `This action was ${decision} by ${actorName} via GitHub.`,
              },
            });
          } catch (err) {
            // Log but don't fail — the approval decision was already recorded
            app.log.warn({ err }, 'Failed to update GitHub check run');
          }
        }
      } catch (error: unknown) {
        const appError = error as { statusCode?: number; message?: string };
        if (appError.statusCode === 409) {
          return reply.send({ message: 'Approval already decided' });
        }
        if (appError.statusCode === 403) {
          return reply.status(403).send({ error: 'Forbidden', message: appError.message ?? 'Separation of duties violation' });
        }
        throw error;
      }
    }

    return reply.send({ ok: true });
  });
}
