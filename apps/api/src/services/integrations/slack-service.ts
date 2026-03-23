export interface SlackConfig {
  bot_token?: string | null;
  webhook_url?: string | null;
  channel_id?: string | null;
  signing_secret?: string | null;
}

export interface ApprovalNotification {
  id: string;
  agent_name: string;
  operation: string;
  target_integration: string;
  data_classification: string;
  risk_classification: string | null;
  flag_reason: string;
  dashboard_url: string;
}

const RISK_EMOJI: Record<string, string> = {
  low: '\u{1F7E2}',
  medium: '\u{1F535}',
  high: '\u{1F7E0}',
  critical: '\u{1F534}',
};

const RISK_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export class SlackService {
  /**
   * Send an approval notification to Slack.
   * Uses bot_token + channel_id if available (supports interactive buttons).
   * Falls back to webhook_url (no buttons — just a link to dashboard).
   */
  async sendApprovalNotification(config: SlackConfig, approval: ApprovalNotification): Promise<void> {
    const risk = approval.risk_classification ?? 'medium';
    const riskEmoji = RISK_EMOJI[risk] ?? '\u{1F535}';
    const riskLabel = RISK_LABEL[risk] ?? 'Medium';

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '\u{1F6E1}\u{FE0F} Approval Required', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${approval.agent_name}* wants to \`${approval.operation}\` on \`${approval.target_integration}\``,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Risk*\n${riskEmoji} ${riskLabel}` },
          { type: 'mrkdwn', text: `*Classification*\n${approval.data_classification}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `>${approval.flag_reason.length > 500 ? approval.flag_reason.slice(0, 499) + '\u{2026}' : approval.flag_reason}` },
      },
      { type: 'divider' },
      {
        type: 'actions',
        block_id: `approval_${approval.id}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '\u{2705} Approve', emoji: true },
            style: 'primary',
            action_id: 'approve_action',
            value: approval.id,
            confirm: {
              title: { type: 'plain_text', text: 'Approve this action?' },
              text: { type: 'mrkdwn', text: `Approve \`${approval.operation}\` by *${approval.agent_name}*?` },
              confirm: { type: 'plain_text', text: 'Approve' },
              deny: { type: 'plain_text', text: 'Cancel' },
            },
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '\u{274C} Deny', emoji: true },
            style: 'danger',
            action_id: 'deny_action',
            value: approval.id,
            confirm: {
              title: { type: 'plain_text', text: 'Deny this action?' },
              text: { type: 'mrkdwn', text: `Deny \`${approval.operation}\` by *${approval.agent_name}*?` },
              confirm: { type: 'plain_text', text: 'Deny' },
              deny: { type: 'plain_text', text: 'Cancel' },
            },
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '\u{1F517} Dashboard', emoji: true },
            url: approval.dashboard_url,
            action_id: 'view_dashboard',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `ID: \`${approval.id.slice(0, 8)}\` \u{00B7} <https://sidclaw.com|SidClaw>` },
        ],
      },
    ];

    if (config.bot_token && config.channel_id) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channel_id,
          text: `\u{1F6E1} Approval Required: ${approval.agent_name} wants to ${approval.operation} on ${approval.target_integration}`,
          blocks,
        }),
      });

      const result = await response.json() as { ok: boolean; error?: string };
      if (!result.ok) {
        console.error(`[Slack] Failed to send message: ${result.error ?? 'unknown error'}`);
      }
    } else if (config.webhook_url) {
      await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `\u{1F6E1} Approval Required: *${approval.agent_name}* wants to \`${approval.operation}\` on \`${approval.target_integration}\`\n>${approval.flag_reason}\n<${approval.dashboard_url}|Review in Dashboard>`,
        }),
      });
    }
  }

  /**
   * Send a test notification (no actionable buttons — just confirms delivery works).
   */
  async sendTestNotification(config: SlackConfig, dashboardUrl: string): Promise<void> {
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\u{2705} *Test Notification*\n\nYour SidClaw Slack integration is working. Approval notifications will appear here with Approve/Deny buttons.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '\u{1F517} Open Dashboard', emoji: true },
            url: dashboardUrl,
            action_id: 'view_dashboard',
          },
        ],
      },
    ];

    if (config.bot_token && config.channel_id) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.bot_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: config.channel_id,
          text: 'SidClaw test notification — your integration is working.',
          blocks,
        }),
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!result.ok) {
        console.error(`[Slack] Failed to send test message: ${result.error ?? 'unknown error'}`);
      }
    } else if (config.webhook_url) {
      await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `\u{2705} *Test Notification* — Your SidClaw Slack integration is working. <${dashboardUrl}|Open Dashboard>`,
        }),
      });
    }
  }

  /**
   * Update the Slack message after approval/denial.
   * Replaces the buttons with the decision result.
   */
  async updateMessage(config: SlackConfig, channelId: string, messageTs: string, decision: 'approved' | 'denied', approverName: string, approval: {
    agent_name: string;
    operation: string;
    target_integration: string;
  }): Promise<void> {
    if (!config.bot_token) return;

    const emoji = decision === 'approved' ? '\u{2705}' : '\u{274C}';
    const verb = decision === 'approved' ? 'Approved' : 'Denied';

    await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.bot_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        ts: messageTs,
        text: `${emoji} ${verb} by ${approverName}: ${approval.agent_name} \u{2192} ${approval.operation}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *${verb}* by *${approverName}*\n\`${approval.operation}\` \u{2192} \`${approval.target_integration}\` by *${approval.agent_name}*`,
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `<https://sidclaw.com|SidClaw>` },
            ],
          },
        ],
      }),
    });
  }
}
