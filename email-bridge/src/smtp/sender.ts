import nodemailer, { Transporter } from 'nodemailer';
import { SaasApi, OutboxEmail } from '../api/supabase';
import { BridgeConfig } from '../config';
import { safeDecrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { EmailAccount } from '../api/supabase';

/**
 * Build a nodemailer transporter from an EmailAccount.
 * Returns null if SMTP config is incomplete.
 */
export function buildSmtpTransport(account: EmailAccount, encryptionKey: string): Transporter | null {
  if (!account.smtp_host) return null;

  const password = safeDecrypt(account.smtp_password_encrypted, encryptionKey);
  if (!password) return null;

  const security = (account.smtp_security || 'STARTTLS').toUpperCase();
  const config: any = {
    host: account.smtp_host,
    port: account.smtp_port || 587,
    secure: security === 'SSL',
    auth: {
      user: account.smtp_username || account.email_address,
      pass: password,
    },
  };

  if (security === 'STARTTLS') {
    config.secure = false;
    config.requireTLS = true;
  }
  if (security === 'NONE') {
    config.secure = false;
    config.ignoreTLS = true;
  }

  return nodemailer.createTransport(config);
}

/**
 * Test SMTP connection by verifying the transport.
 */
export async function testSmtpConnection(transport: Transporter): Promise<{ ok: boolean; error?: string }> {
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export class SmtpSender {
  private api: SaasApi;
  private config: BridgeConfig;

  constructor(api: SaasApi, config: BridgeConfig) {
    this.api = api;
    this.config = config;
  }

  async processOutbox(): Promise<void> {
    try {
      const emails = await this.api.pollOutbox();
      if (emails.length === 0) return;

      logger.info({ count: emails.length }, 'Processing outbox');

      for (const email of emails) {
        await this.sendEmail(email);
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Outbox processing error');
    }
  }

  private async sendEmail(email: OutboxEmail): Promise<void> {
    const emailLog = { queueId: email.id, to: email.to_recipients?.[0]?.email };
    const account = email.email_accounts;

    if (!account?.smtp_host) {
      logger.warn(emailLog, 'No SMTP config for account');
      await this.api.confirmSend(email.id, false, undefined, 'No SMTP configuration');
      return;
    }

    try {
      const password = safeDecrypt(account.smtp_password_encrypted, this.config.ENCRYPTION_KEY);
      if (!password) {
        await this.api.confirmSend(email.id, false, undefined, 'Missing SMTP password');
        return;
      }

      const security = (account.smtp_security || 'STARTTLS').toUpperCase();
      const transportConfig: any = {
        host: account.smtp_host,
        port: account.smtp_port || 587,
        secure: security === 'SSL',
        auth: {
          user: account.smtp_username || account.email_address,
          pass: password,
        },
      };

      if (security === 'STARTTLS') {
        transportConfig.secure = false;
        transportConfig.requireTLS = true;
      }

      if (security === 'NONE') {
        transportConfig.secure = false;
        transportConfig.ignoreTLS = true;
      }

      const transporter = nodemailer.createTransport(transportConfig);

      // Build attachments
      const attachments = (email.attachments || []).map((att) => ({
        filename: att.filename,
        content: att.content_base64 ? Buffer.from(att.content_base64, 'base64') : undefined,
        contentType: att.content_type,
      })).filter(a => a.content);

      // Build recipients
      const to = email.to_recipients.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email);
      const cc = (email.cc_recipients || []).map(r => r.name ? `"${r.name}" <${r.email}>` : r.email);
      const bcc = (email.bcc_recipients || []).map(r => r.name ? `"${r.name}" <${r.email}>` : r.email);

      const mailOptions: any = {
        from: account.email_address,
        to: to.join(', '),
        subject: email.subject || '',
        text: email.body_text || undefined,
        html: email.body_html || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      if (cc.length > 0) mailOptions.cc = cc.join(', ');
      if (bcc.length > 0) mailOptions.bcc = bcc.join(', ');
      if (email.reply_to_message_id) {
        mailOptions.inReplyTo = email.reply_to_message_id;
        mailOptions.references = email.reply_to_message_id;
      }

      const info = await transporter.sendMail(mailOptions);
      const sentMessageId = info.messageId || `<${Date.now()}@bridge-sent>`;

      logger.info({ ...emailLog, messageId: sentMessageId }, 'Email sent');
      await this.api.confirmSend(email.id, true, sentMessageId);

      transporter.close();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error({ ...emailLog, err: errorMsg }, 'SMTP send failed');
      await this.api.confirmSend(email.id, false, undefined, errorMsg);
    }
  }
}
