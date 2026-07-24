import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { getDecryptedEmailConfig } from '@/lib/auth/secrets-config';
import type { EmailDispatcher, EmailMessage, EmailConfig } from './dispatcher';

const BATCH_LIMIT = 10; // Max emails per batch (ADR-003)

class SyncEmailDispatcher implements EmailDispatcher {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<{ success: boolean; error?: string }> {
    const from = message.from || `${this.config.fromName || 'AuthForge'} <${this.config.fromEmail}>`;

    try {
      if (this.config.provider === 'resend') {
        return this.sendViaResend({ ...message, from });
      }
      return this.sendViaSMTP({ ...message, from });
    } catch (error) {
      console.error('[Email] Send failed:', error);
      return { success: false, error: 'Falha ao enviar email' };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<{ success: boolean; sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    // Process in chunks to avoid timeouts (ADR-003)
    const chunks = [];
    for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
      chunks.push(messages.slice(i, i + BATCH_LIMIT));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map((msg) => this.send(msg)),
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    return { success: failed === 0, sent, failed };
  }

  private async sendViaResend(message: EmailMessage & { from: string }) {
    if (!this.config.apiKey) {
      return { success: false, error: 'API key do Resend não configurada' };
    }

    const resend = new Resend(this.config.apiKey);
    const { error } = await resend.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  private async sendViaSMTP(message: EmailMessage & { from: string }) {
    if (!this.config.smtpHost) {
      return { success: false, error: 'SMTP não configurado' };
    }

    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort || 587,
      secure: (this.config.smtpPort || 587) === 465,
      auth: this.config.smtpUser
        ? { user: this.config.smtpUser, pass: this.config.smtpPass }
        : undefined,
    });

    await transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    return { success: true };
  }
}

// Cached dispatcher instance
let cachedDispatcher: EmailDispatcher | null = null;

export async function getEmailDispatcher(): Promise<EmailDispatcher> {
  if (cachedDispatcher) return cachedDispatcher;

  const config = await getDecryptedEmailConfig();

  const emailConfig: EmailConfig = {
    provider: (config?.provider as 'resend' | 'smtp') || 'resend',
    apiKey: config?.apiKey || process.env.RESEND_API_KEY,
    smtpHost: config?.smtpHost || process.env.SMTP_HOST,
    smtpPort: config?.smtpPort || parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: config?.smtpUser || process.env.SMTP_USER,
    smtpPass: config?.smtpPass || process.env.SMTP_PASS,
    fromEmail: config?.fromEmail || process.env.EMAIL_FROM || 'noreply@authforge.dev',
    fromName: config?.fromName || 'AuthForge',
  };

  cachedDispatcher = new SyncEmailDispatcher(emailConfig);
  return cachedDispatcher;
}

export function invalidateEmailCache() {
  cachedDispatcher = null;
}

// Convenience function for single email
export async function sendEmail(message: EmailMessage) {
  const dispatcher = await getEmailDispatcher();
  return dispatcher.send(message);
}
