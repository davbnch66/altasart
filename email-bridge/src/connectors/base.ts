import { EmailAccount } from '../api/supabase';

export interface EmailMessage {
  message_id: string;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails: string[];
  subject: string;
  body_text: string;
  body_html: string;
  date: Date;
  folder: string;
  attachments: Array<{
    filename: string;
    content_type: string;
    size: number;
    content_base64: string;
  }>;
  in_reply_to?: string;
  references?: string[];
}

export interface SendEmailParams {
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;
  body_html: string;
  body_text: string;
  reply_to_message_id?: string;
  attachments?: Array<{ filename: string; content_base64: string; content_type: string }>;
}

export interface SendResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

export interface TestResult {
  smtp_ok: boolean;
  imap_ok: boolean;
  error?: string;
}

export interface IEmailConnector {
  /** Unique connector type identifier */
  readonly type: 'gmail' | 'outlook' | 'imap-smtp';

  /** Fetch new emails since the given date */
  fetchEmails(account: EmailAccount, sinceDate: Date, maxMessages: number): Promise<EmailMessage[]>;

  /** Send an email */
  sendEmail(account: EmailAccount, params: SendEmailParams): Promise<SendResult>;

  /** Test the connection */
  testConnection(account: EmailAccount): Promise<TestResult>;
}

/**
 * Select the appropriate connector based on account provider and auth_method
 */
export function selectConnector(
  account: EmailAccount,
  connectors: Map<string, IEmailConnector>,
): IEmailConnector {
  // OAuth accounts use their dedicated API connector
  if (account.auth_method === 'oauth2') {
    if (account.provider === 'gmail') {
      const c = connectors.get('gmail');
      if (c) return c;
    }
    if (account.provider === 'outlook') {
      const c = connectors.get('outlook');
      if (c) return c;
    }
  }

  // Everything else falls back to IMAP/SMTP
  const c = connectors.get('imap-smtp');
  if (!c) throw new Error('No IMAP/SMTP connector registered');
  return c;
}
