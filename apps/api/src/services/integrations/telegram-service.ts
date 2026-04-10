export interface TelegramApprovalNotification {
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

export class TelegramService {
  async sendApprovalNotification(botToken: string, chatId: string, approval: TelegramApprovalNotification): Promise<void> {
    const risk = approval.risk_classification ?? 'medium';
    const riskEmoji = RISK_EMOJI[risk] ?? '\u{1F535}';
    const riskLabel = RISK_LABEL[risk] ?? 'Medium';

    // Use HTML parse mode — much more reliable than Markdown for mixed content
    const text = [
      `\u{1F6E1} <b>Approval Required</b>`,
      ``,
      `<b>${this.escapeHtml(approval.agent_name)}</b> wants to <code>${this.escapeHtml(approval.operation)}</code> on <code>${this.escapeHtml(approval.target_integration)}</code>`,
      ``,
      `${riskEmoji} <b>${riskLabel}</b>  \u{00B7}  ${this.escapeHtml(approval.data_classification)}`,
      ``,
      `<i>${this.escapeHtml(this.truncate(approval.flag_reason, 500))}</i>`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '\u{2705} Approve', callback_data: `approve:${approval.id}` },
          { text: '\u{274C} Deny', callback_data: `deny:${approval.id}` },
          { text: '\u{1F517} Dashboard', url: approval.dashboard_url },
        ],
      ],
    };

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Telegram] Failed to send message: ${error}`);
    }
  }

  /**
   * Send a test notification (no actionable buttons — just confirms delivery works).
   */
  async sendTestNotification(botToken: string, chatId: string, dashboardUrl: string): Promise<void> {
    const text = [
      `\u{2705} <b>Test Notification</b>`,
      ``,
      `Your SidClaw Telegram integration is working.`,
      `Approval notifications will appear here with Approve/Deny buttons.`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: '\u{1F517} Open Dashboard', url: dashboardUrl }],
      ],
    };

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Telegram] Failed to send test message: ${error}`);
    }
  }

  /**
   * Update message after decision (remove buttons, show result).
   */
  async updateMessage(botToken: string, chatId: string, messageId: number, decision: 'approved' | 'denied', approverName: string): Promise<void> {
    const emoji = decision === 'approved' ? '\u{2705}' : '\u{274C}';
    const verb = decision === 'approved' ? 'Approved' : 'Denied';

    // Remove buttons
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    });

    // Reply with decision
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${emoji} <b>${verb}</b> by ${this.escapeHtml(approverName)}`,
        parse_mode: 'HTML',
        reply_to_message_id: messageId,
      }),
    });
  }

  /**
   * Register webhook URL with Telegram.
   */
  async setWebhook(botToken: string, webhookUrl: string, secretToken?: string): Promise<boolean> {
    const payload: Record<string, string> = { url: webhookUrl };
    if (secretToken) payload.secret_token = secretToken;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[Telegram] Failed to set webhook: ${await response.text()}`);
      return false;
    }
    return true;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '\u{2026}' : text;
  }
}
