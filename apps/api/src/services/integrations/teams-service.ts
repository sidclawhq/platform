export interface TeamsConfig {
  webhook_url?: string | null;
  bot_id?: string | null;
  bot_secret?: string | null;
}

export interface TeamsApprovalNotification {
  id: string;
  agent_name: string;
  operation: string;
  target_integration: string;
  data_classification: string;
  risk_classification: string | null;
  flag_reason: string;
  dashboard_url: string;
  owner_name?: string | null;
  expires_at?: string | null;
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

export class TeamsService {
  /**
   * Send an approval notification to Microsoft Teams.
   * Uses bot_id + bot_secret if available (supports interactive Action.Submit buttons).
   * Falls back to webhook_url (card with "Open in Dashboard" link only).
   */
  async sendApprovalNotification(config: TeamsConfig, approval: TeamsApprovalNotification): Promise<void> {
    const risk = approval.risk_classification ?? 'medium';
    const riskEmoji = RISK_EMOJI[risk] ?? '\u{1F535}';
    const riskLabel = RISK_LABEL[risk] ?? 'Medium';
    const isHighRisk = risk === 'high' || risk === 'critical';

    // Human-readable operation: "order_labs" → "Order Labs"
    const humanOp = approval.operation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const humanTarget = approval.target_integration.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Timing info
    const requestedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    let expiryText = '';
    if (approval.expires_at) {
      const expiresAt = new Date(approval.expires_at);
      const minutesLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));
      const hours = Math.floor(minutesLeft / 60);
      const mins = minutesLeft % 60;
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        expiryText = days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`;
      } else if (hours > 0) {
        expiryText = mins > 0 ? `Expires in ${hours}h ${mins}m` : `Expires in ${hours}h`;
      } else {
        expiryText = `Expires in ${mins}m`;
      }
    }

    const cardBody: Record<string, unknown>[] = [
      // Header
      {
        type: 'TextBlock',
        text: '\u{1F6E1}\u{FE0F} Approval Required',
        weight: 'Bolder',
        size: 'Large',
      },

      // Risk banner — highlighted container for high/critical risk
      ...(isHighRisk ? [{
        type: 'Container',
        style: risk === 'critical' ? 'attention' : 'warning',
        bleed: true,
        items: [{
          type: 'TextBlock',
          text: `${riskEmoji} ${riskLabel.toUpperCase()} RISK`,
          weight: 'Bolder',
          color: risk === 'critical' ? 'Attention' : 'Warning',
        }],
      }] : []),

      // Agent + owner info
      {
        type: 'FactSet',
        facts: [
          { title: 'Agent', value: approval.agent_name },
          ...(approval.owner_name ? [{ title: 'Requested by', value: approval.owner_name }] : []),
          { title: 'Action', value: `${humanOp} on ${humanTarget}` },
        ],
      },

      // Risk + Classification in columns (for non-high-risk, show risk inline)
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [{
              type: 'TextBlock',
              text: `${riskEmoji} **${riskLabel}** risk`,
              size: 'Small',
            }],
          },
          {
            type: 'Column',
            width: 'auto',
            items: [{
              type: 'TextBlock',
              text: `\u{1F4CB} ${approval.data_classification}`,
              size: 'Small',
            }],
          },
        ],
        separator: true,
      },

      // Policy rationale
      {
        type: 'TextBlock',
        text: approval.flag_reason.length > 500 ? approval.flag_reason.slice(0, 499) + '\u{2026}' : approval.flag_reason,
        wrap: true,
        color: 'Warning',
        separator: true,
      },

      // Footer: ID + timing + branding
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'stretch',
            items: [{
              type: 'TextBlock',
              text: [
                `ID: ${approval.id.slice(0, 8)}`,
                requestedAt,
                expiryText,
              ].filter(Boolean).join(' \u{00B7} '),
              size: 'Small',
              isSubtle: true,
              wrap: true,
            }],
          },
          {
            type: 'Column',
            width: 'auto',
            items: [{
              type: 'TextBlock',
              text: 'via [SidClaw](https://sidclaw.com)',
              size: 'Small',
              isSubtle: true,
              horizontalAlignment: 'Right',
            }],
          },
        ],
      },
    ];

    if (config.bot_id && config.bot_secret) {
      // Bot Framework mode — interactive buttons
      const card = {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.4',
        body: cardBody,
        actions: [
          {
            type: 'Action.Submit',
            title: '\u{2705} Approve',
            style: 'positive',
            data: { action: 'approve', approval_id: approval.id },
          },
          {
            type: 'Action.Submit',
            title: '\u{274C} Deny',
            style: 'destructive',
            data: { action: 'deny', approval_id: approval.id },
          },
          {
            type: 'Action.OpenUrl',
            title: '\u{1F517} Full Details',
            url: approval.dashboard_url,
          },
        ],
      };

      if (config.webhook_url) {
        await this.sendCardViaWebhook(config.webhook_url, card);
      }
    } else if (config.webhook_url) {
      // Webhook-only mode — OpenUrl button
      const card = {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.4',
        body: cardBody,
        actions: [
          {
            type: 'Action.OpenUrl',
            title: '\u{1F6E1}\u{FE0F} Review & Decide',
            url: approval.dashboard_url,
          },
        ],
      };

      await this.sendCardViaWebhook(config.webhook_url, card);
    }
  }

  /**
   * Send a test notification (no actionable buttons — just confirms delivery works).
   */
  async sendTestNotification(config: TeamsConfig, dashboardUrl: string): Promise<void> {
    const card = {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: '\u{2705} Test Notification',
          weight: 'Bolder',
          size: 'Large',
        },
        {
          type: 'TextBlock',
          text: 'Your SidClaw Microsoft Teams integration is working. Approval notifications will appear here.',
          wrap: true,
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: '\u{1F517} Open Dashboard',
          url: dashboardUrl,
        },
      ],
    };

    if (config.webhook_url) {
      await this.sendCardViaWebhook(config.webhook_url, card);
    }
  }

  /**
   * Build an updated card after approval/denial (replaces the original card).
   */
  buildDecisionCard(decision: 'approved' | 'denied', approverName: string, approval: {
    agent_name: string;
    operation: string;
    target_integration: string;
  }): Record<string, unknown> {
    const emoji = decision === 'approved' ? '\u{2705}' : '\u{274C}';
    const verb = decision === 'approved' ? 'Approved' : 'Denied';
    const color = decision === 'approved' ? 'Good' : 'Attention';

    return {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `${emoji} ${verb} by ${approverName}`,
          color,
          weight: 'Bolder',
          size: 'Large',
        },
        {
          type: 'FactSet',
          facts: [
            { title: 'Agent', value: approval.agent_name },
            { title: 'Operation', value: `${approval.operation} \u{2192} ${approval.target_integration}` },
            { title: 'Decided at', value: new Date().toISOString() },
          ],
        },
      ],
    };
  }

  /**
   * Update a Teams message via Bot Framework (replace card with decision result).
   * Uses the Bot Framework REST API to update the activity.
   */
  async updateMessage(
    serviceUrl: string,
    conversationId: string,
    activityId: string,
    botId: string,
    botSecret: string,
    decisionCard: Record<string, unknown>,
  ): Promise<void> {
    const token = await this.getBotFrameworkToken(botId, botSecret);
    if (!token) return;

    const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${conversationId}/activities/${activityId}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: decisionCard,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[Teams] Failed to update message: ${response.status} ${await response.text()}`);
    }
  }

  /**
   * Get a Bot Framework OAuth token for API calls.
   */
  async getBotFrameworkToken(botId: string, botSecret: string): Promise<string | null> {
    try {
      const response = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: botId,
          client_secret: botSecret,
          scope: 'https://api.botframework.com/.default',
        }).toString(),
      });

      if (!response.ok) {
        console.error(`[Teams] Failed to get Bot Framework token: ${response.status}`);
        return null;
      }

      const data = await response.json() as { access_token?: string };
      return data.access_token ?? null;
    } catch (error) {
      console.error('[Teams] Token error:', error);
      return null;
    }
  }

  /**
   * Send an Adaptive Card via incoming webhook URL.
   */
  private async sendCardViaWebhook(webhookUrl: string, card: Record<string, unknown>): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Teams] Failed to send card: ${response.status} ${error}`);
    }
  }
}
