import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { db } from './db';
import { decrypt } from './auth/secrets';

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  try {
    // Busca a configuração de e-mail no banco
    const emailConfig = await db.emailConfig.findFirst();

    if (!emailConfig) {
      console.warn('⚠️ E-mail não enviado: Configuração de e-mail não encontrada no banco de dados.');
      // Fallback para log no console se não houver config (útil para dev)
      console.log(`\n📧 [EMAIL MOCK] Para: ${to}\nAssunto: ${subject}\nConteúdo:\n${html}\n`);
      return { success: true, message: 'Simulated email sent' };
    }

    const { provider, fromEmail, fromName } = emailConfig;
    const sender = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    if (provider === 'smtp') {
      if (!emailConfig.smtpHost || !emailConfig.smtpPort || !emailConfig.smtpUser) {
        throw new Error('Configurações SMTP incompletas.');
      }

      const transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: emailConfig.smtpUser,
          pass: emailConfig.smtpPass ? decrypt(emailConfig.smtpPass) : '',
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const info = await transporter.sendMail({
        from: sender,
        to,
        subject,
        html,
      });

      console.log('✅ E-mail enviado via SMTP:', info.messageId);
      return { success: true, messageId: info.messageId };

    } else if (provider === 'resend') {
      if (!emailConfig.apiKey) {
        throw new Error('API Key do Resend não configurada.');
      }

      const resend = new Resend(decrypt(emailConfig.apiKey));
      const { data, error } = await resend.emails.send({
        from: sender,
        to,
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('✅ E-mail enviado via Resend:', data?.id);
      return { success: true, id: data?.id };
    }

    throw new Error(`Provedor de e-mail desconhecido: ${provider}`);

  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
