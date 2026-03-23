export interface TeamsApprovalNotification {
  id: string;
  agent_name: string;
  operation: string;
  target_integration: string;
  data_classification: string;
  risk_classification: string | null;
  flag_reason: string;
  dashboard_url: string;
}

const RISK_COLOR: Record<string, string> = {
  low: 'good',
  medium: 'accent',
  high: 'warning',
  critical: 'attention',
};

const RISK_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export class TeamsService {
  /**
   * Send an Adaptive Card to a Teams incoming webhook.
   * Teams webhooks only support Action.OpenUrl (links to dashboard), not external callbacks.
   */
  async sendApprovalNotification(webhookUrl: string, approval: TeamsApprovalNotification): Promise<void> {
    const risk = approval.risk_classification ?? 'medium';
    const riskColor = RISK_COLOR[risk] ?? 'accent';
    const riskLabel = RISK_LABEL[risk] ?? 'Medium';

    const card = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: '\u{1F6E1}\u{FE0F} Approval Required',
              weight: 'Bolder',
              size: 'Large',
            },
            {
              type: 'TextBlock',
              text: `**${approval.agent_name}** wants to \`${approval.operation}\` on \`${approval.target_integration}\``,
              wrap: true,
              size: 'Medium',
            },
            {
              type: 'ColumnSet',
              columns: [
                {
                  type: 'Column',
                  width: 'auto',
                  items: [
                    {
                      type: 'TextBlock',
                      text: `Risk: **${riskLabel}**`,
                      color: riskColor,
                      size: 'Small',
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'auto',
                  items: [
                    {
                      type: 'TextBlock',
                      text: `Classification: **${approval.data_classification}**`,
                      size: 'Small',
                      isSubtle: true,
                    },
                  ],
                },
              ],
            },
            {
              type: 'TextBlock',
              text: approval.flag_reason,
              wrap: true,
              size: 'Small',
              isSubtle: true,
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: '\u{2705} Review & Approve',
              url: `${approval.dashboard_url}?action=approve`,
              style: 'positive',
            },
            {
              type: 'Action.OpenUrl',
              title: '\u{274C} Review & Deny',
              url: `${approval.dashboard_url}?action=deny`,
              style: 'destructive',
            },
          ],
        },
      }],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      console.error(`[Teams] Failed to send card: ${response.status} ${await response.text()}`);
    }
  }

  /**
   * Send a test notification (confirms delivery works, no actionable buttons).
   */
  async sendTestNotification(webhookUrl: string, dashboardUrl: string): Promise<void> {
    const card = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
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
              text: 'Your SidClaw Teams integration is working. Approval notifications will appear here with review links.',
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
        },
      }],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      console.error(`[Teams] Failed to send test card: ${response.status} ${await response.text()}`);
    }
  }
}
