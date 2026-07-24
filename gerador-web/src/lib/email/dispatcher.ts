/**
 * Email Dispatcher Interface (ADR-003)
 *
 * Abstraction layer for email sending that facilitates future migration
 * from synchronous to asynchronous (queue-based) delivery.
 *
 * v1 (current): Synchronous sending via SMTP/Resend
 * v2 (future):  Queue-based with BullMQ/Inngest/QStash
 *
 * Migration path:
 *   1. Create a new class implementing EmailDispatcher
 *   2. Swap the implementation in getDispatcher()
 *   3. Server Actions remain unchanged
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export interface EmailDispatcher {
  send(message: EmailMessage): Promise<{ success: boolean; error?: string }>;
  sendBatch(messages: EmailMessage[]): Promise<{ success: boolean; sent: number; failed: number }>;
}

export interface EmailConfig {
  provider: 'resend' | 'smtp';
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName?: string;
}
