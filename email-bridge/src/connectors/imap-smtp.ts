import { IEmailConnector, EmailMessage, SendEmailParams, SendResult, TestResult } from './base';
import { EmailAccount } from '../api/supabase';
import { buildImapConfig, fetchNewEmails, testImapConnection } from '../imap/connector';
import { buildSmtpTransport, testSmtpConnection } from '../smtp/sender';
import { parseRawEmail } from '../utils/parser';
import { safeDecrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

export class ImapSmtpConnector implements IEmailConnector {
  readonly type = 'imap-smtp' as const;
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  async fetchEmails(account: EmailAccount, sinceDate: Date, maxMessages: number): Promise<EmailMessage[]> {
    const imapConfig = buildImapConfig(account, this.encryptionKey);
    if (!imapConfig) {
      logger.warn({ accountId: account.id }, 'IMAP config incomplete, skipping');
      return [];
    }

    const rawMessages = await fetchNewEmails(imapConfig, sinceDate, maxMessages);
    const messages: EmailMessage[] = [];

    for (const { raw } of rawMessages) {
      try {
        const parsed = await parseRawEmail(raw, 'INBOX');
        messages.push({
          message_id: parsed.message_id,
          from_email: parsed.from_email,
          from_name: parsed.from_name,
          to_emails: parsed.to_emails.map(a => a.email),
          cc_emails: parsed.cc_emails.map(a => a.email),
          subject: parsed.subject,
          body_text: parsed.body_text,
          body_html: parsed.body_html,
          date: new Date(parsed.received_at),
          folder: parsed.folder || 'INBOX',
          attachments: (parsed.attachments || []).map(a => ({
            filename: a.filename,
            content_type: a.content_type,
            size: a.size,
            content_base64: a.content_base64 || '',
          })),
        });
      } catch (err) {
        logger.warn({ accountId: account.id, err: err instanceof Error ? err.message : String(err) }, 'Failed to parse email');
      }
    }

    return messages;
  }

  async sendEmail(account: EmailAccount, params: SendEmailParams): Promise<SendResult> {
    try {
      const transport = buildSmtpTransport(account, this.encryptionKey);
      if (!transport) return { success: false, error: 'SMTP config incomplete' };

      const mailOptions: any = {
        from: account.email_address,
        to: params.to.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', '),
        subject: params.subject,
        text: params.body_text,
        html: params.body_html,
      };

      if (params.cc?.length) {
        mailOptions.cc = params.cc.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ');
      }
      if (params.bcc?.length) {
        mailOptions.bcc = params.bcc.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ');
      }
      if (params.reply_to_message_id) {
        mailOptions.inReplyTo = params.reply_to_message_id;
        mailOptions.references = params.reply_to_message_id;
      }
      if (params.attachments?.length) {
        mailOptions.attachments = params.attachments.map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content_base64, 'base64'),
          contentType: a.content_type,
        }));
      }

      const info = await transport.sendMail(mailOptions);
      return { success: true, message_id: info.messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async testConnection(account: EmailAccount): Promise<TestResult> {
    let smtp_ok = false;
    let imap_ok = false;
    let error: string | undefined;

    // Test SMTP
    try {
      const transport = buildSmtpTransport(account, this.encryptionKey);
      if (transport) {
        const result = await testSmtpConnection(transport);
        smtp_ok = result.ok;
        if (!result.ok) error = result.error;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    // Test IMAP
    try {
      const imapConfig = buildImapConfig(account, this.encryptionKey);
      if (imapConfig) {
        const result = await testImapConnection(imapConfig);
        imap_ok = result.ok;
        if (!result.ok && !error) error = result.error;
      }
    } catch (err) {
      if (!error) error = err instanceof Error ? err.message : String(err);
    }

    return { smtp_ok, imap_ok, error };
  }
}
