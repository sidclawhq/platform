export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private provider: 'resend' | 'none';

  constructor() {
    this.provider = process.env['EMAIL_API_KEY'] ? 'resend' : 'none';
    if (this.provider === 'none') {
      console.log('Email notifications disabled — EMAIL_API_KEY not set');
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (this.provider === 'none') {
      console.log(`[Email] Would send to ${message.to.join(', ')}: ${message.subject}`);
      return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env['EMAIL_API_KEY']);

    await resend.emails.send({
      from: process.env['EMAIL_FROM'] ?? 'SidClaw <notifications@sidclaw.com>',
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
