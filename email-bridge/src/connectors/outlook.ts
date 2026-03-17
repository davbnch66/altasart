import { IEmailConnector, EmailMessage, SendEmailParams, SendResult, TestResult } from './base';
import { EmailAccount } from '../api/supabase';
import { safeDecrypt } from '../utils/crypto';
import { refreshMicrosoftToken } from '../oauth/microsoft';
import { logger } from '../utils/logger';

const GRAPH_API = 'https://graph.microsoft.com/v1.0/me';

export class OutlookConnector implements IEmailConnector {
  readonly type = 'outlook' as const;
  private encryptionKey: string;
  private clientId: string;
  private clientSecret: string;

  private tokenCache = new Map<string, { access_token: string; expires_at: number }>();

  constructor(encryptionKey: string, clientId: string, clientSecret: string) {
    this.encryptionKey = encryptionKey;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getAccessToken(account: EmailAccount): Promise<string> {
    const cached = this.tokenCache.get(account.id);
    if (cached && cached.expires_at > Date.now() + 60_000) {
      return cached.access_token;
    }

    const refreshToken = safeDecrypt(account.oauth_refresh_token_encrypted, this.encryptionKey);
    if (!refreshToken) throw new Error('No refresh token available for Outlook account');

    const tokens = await refreshMicrosoftToken(refreshToken, this.clientId, this.clientSecret);

    this.tokenCache.set(account.id, {
      access_token: tokens.access_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    });

    logger.info({ accountId: account.id }, 'Outlook token refreshed');
    return tokens.access_token;
  }

  private async graphFetch(account: EmailAccount, path: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken(account);
    const res = await fetch(`${GRAPH_API}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 401) {
      this.tokenCache.delete(account.id);
      const newToken = await this.getAccessToken(account);
      return fetch(`${GRAPH_API}${path}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    return res;
  }

  async fetchEmails(account: EmailAccount, sinceDate: Date, maxMessages: number): Promise<EmailMessage[]> {
    const isoDate = sinceDate.toISOString();
    const filter = `receivedDateTime ge ${isoDate}`;
    const select = 'id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,internetMessageId,internetMessageHeaders,hasAttachments,parentFolderId';

    const res = await this.graphFetch(
      account,
      `/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=${maxMessages}&$orderby=receivedDateTime desc`,
    );

    if (!res.ok) {
      throw new Error(`Graph list messages failed [${res.status}]`);
    }

    const data = (await res.json()) as { value: GraphMessage[] };
    return (data.value || []).map(msg => this.parseGraphMessage(msg));
  }

  private parseGraphMessage(msg: GraphMessage): EmailMessage {
    const internetHeaders = new Map<string, string>();
    for (const h of msg.internetMessageHeaders || []) {
      internetHeaders.set(h.name.toLowerCase(), h.value);
    }

    return {
      message_id: msg.internetMessageId || msg.id,
      from_email: msg.from?.emailAddress?.address || '',
      from_name: msg.from?.emailAddress?.name || '',
      to_emails: (msg.toRecipients || []).map(r => r.emailAddress?.address || '').filter(Boolean),
      cc_emails: (msg.ccRecipients || []).map(r => r.emailAddress?.address || '').filter(Boolean),
      subject: msg.subject || '',
      body_text: msg.body?.contentType === 'text' ? msg.body.content : '',
      body_html: msg.body?.contentType === 'html' ? msg.body.content : '',
      date: new Date(msg.receivedDateTime || Date.now()),
      folder: 'INBOX', // Could map parentFolderId
      attachments: [], // Fetched separately if needed
      in_reply_to: internetHeaders.get('in-reply-to'),
      references: internetHeaders.get('references')?.split(/\s+/),
    };
  }

  async sendEmail(account: EmailAccount, params: SendEmailParams): Promise<SendResult> {
    try {
      const message: any = {
        subject: params.subject,
        body: {
          contentType: 'html',
          content: params.body_html,
        },
        toRecipients: params.to.map(r => ({
          emailAddress: { address: r.email, name: r.name || r.email },
        })),
      };

      if (params.cc?.length) {
        message.ccRecipients = params.cc.map(r => ({
          emailAddress: { address: r.email, name: r.name || r.email },
        }));
      }
      if (params.bcc?.length) {
        message.bccRecipients = params.bcc.map(r => ({
          emailAddress: { address: r.email, name: r.name || r.email },
        }));
      }

      const res = await this.graphFetch(account, '/sendMail', {
        method: 'POST',
        body: JSON.stringify({ message, saveToSentItems: true }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Graph sendMail failed [${res.status}]: ${text}` };
      }

      return { success: true, message_id: `outlook-${Date.now()}` };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async testConnection(account: EmailAccount): Promise<TestResult> {
    try {
      const token = await this.getAccessToken(account);

      const res = await fetch(`${GRAPH_API}/mailFolders/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        return { smtp_ok: true, imap_ok: true };
      }

      const text = await res.text();
      return { smtp_ok: false, imap_ok: false, error: `Graph API error [${res.status}]: ${text}` };
    } catch (err) {
      return { smtp_ok: false, imap_ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// Microsoft Graph types
interface GraphMessage {
  id: string;
  subject: string;
  internetMessageId?: string;
  receivedDateTime: string;
  from?: { emailAddress?: { address: string; name: string } };
  toRecipients?: Array<{ emailAddress?: { address: string; name: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address: string; name: string } }>;
  body?: { contentType: string; content: string };
  hasAttachments?: boolean;
  parentFolderId?: string;
  internetMessageHeaders?: Array<{ name: string; value: string }>;
}
