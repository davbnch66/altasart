import { BridgeConfig } from '../config';
import { logger } from '../utils/logger';

export interface EmailAccount {
  id: string;
  email_address: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_security: string | null;
  imap_username: string | null;
  imap_password_encrypted: string | null;
}

export interface OutboxEmail {
  id: string;
  account_id: string;
  to_recipients: Array<{ email: string; name?: string }>;
  cc_recipients: Array<{ email: string; name?: string }>;
  bcc_recipients: Array<{ email: string; name?: string }>;
  subject: string;
  body_html: string;
  body_text: string;
  reply_to_message_id?: string;
  attachments: Array<{ filename: string; content_base64: string; content_type: string }>;
  email_accounts: EmailAccount;
}

export class SaasApi {
  private baseUrl: string;
  private secret: string;

  constructor(config: BridgeConfig) {
    this.baseUrl = config.SUPABASE_FUNCTIONS_URL;
    this.secret = config.EMAIL_BRIDGE_SECRET;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Bridge-Secret': this.secret,
    };
  }

  async pushSyncedEmails(accountId: string, emails: any[]): Promise<{ inserted: number; skipped: number; linked: number }> {
    const res = await fetch(`${this.baseUrl}/email-bridge-sync`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ account_id: accountId, emails }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sync push failed [${res.status}]: ${text}`);
    }

    const json = (await res.json()) as { inserted: number; skipped: number; linked: number };
    return json;
  }

  async pollOutbox(): Promise<OutboxEmail[]> {
    const res = await fetch(`${this.baseUrl}/email-bridge-send?action=poll`, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Outbox poll failed [${res.status}]: ${text}`);
    }

    const data = (await res.json()) as { emails?: OutboxEmail[] };
    return data.emails || [];
  }

  async confirmSend(queueId: string, success: boolean, sentMessageId?: string, error?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/email-bridge-send?action=confirm`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        queue_id: queueId,
        success,
        sent_message_id: sentMessageId,
        error: error?.slice(0, 500),
      }),
    });

    if (!res.ok) {
      logger.warn({ queueId, status: res.status }, 'Confirm send failed');
    }
  }

  async pollTestRequests(): Promise<EmailAccount[]> {
    const res = await fetch(`${this.baseUrl}/email-bridge-test?action=poll`, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!res.ok) return [];
    const data = (await res.json()) as { accounts?: EmailAccount[] };
    return data.accounts || [];
  }

  async reportTestResult(accountId: string, smtpOk: boolean, imapOk: boolean, error?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/email-bridge-test?action=result`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        account_id: accountId,
        smtp_ok: smtpOk,
        imap_ok: imapOk,
        error: error?.slice(0, 500),
      }),
    });

    if (!res.ok) {
      logger.warn({ accountId, status: res.status }, 'Report test result failed');
    }
  }
}
