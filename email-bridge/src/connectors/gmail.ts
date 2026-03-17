import { IEmailConnector, EmailMessage, SendEmailParams, SendResult, TestResult } from './base';
import { EmailAccount } from '../api/supabase';
import { safeDecrypt } from '../utils/crypto';
import { refreshGoogleToken } from '../oauth/google';
import { logger } from '../utils/logger';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailConnector implements IEmailConnector {
  readonly type = 'gmail' as const;
  private encryptionKey: string;
  private clientId: string;
  private clientSecret: string;

  // In-memory token cache: accountId → { access_token, expires_at }
  private tokenCache = new Map<string, { access_token: string; expires_at: number }>();

  constructor(encryptionKey: string, clientId: string, clientSecret: string) {
    this.encryptionKey = encryptionKey;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async getAccessToken(account: EmailAccount): Promise<string> {
    // Check cache
    const cached = this.tokenCache.get(account.id);
    if (cached && cached.expires_at > Date.now() + 60_000) {
      return cached.access_token;
    }

    // Decrypt refresh token
    const refreshToken = safeDecrypt(account.oauth_refresh_token_encrypted, this.encryptionKey);
    if (!refreshToken) throw new Error('No refresh token available for Gmail account');

    const tokens = await refreshGoogleToken(refreshToken, this.clientId, this.clientSecret);

    this.tokenCache.set(account.id, {
      access_token: tokens.access_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    });

    // Report new token back to SaaS for persistence
    await this.reportTokenRefresh(account.id, tokens.access_token, tokens.expires_in);

    return tokens.access_token;
  }

  private async reportTokenRefresh(accountId: string, accessToken: string, expiresIn: number): Promise<void> {
    // This will be called by the poller to update the SaaS
    // The poller has access to the SaasApi instance
    // For now, we emit an event that the poller can listen to
    logger.info({ accountId }, 'Gmail token refreshed');
  }

  private async gmailFetch(account: EmailAccount, path: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken(account);
    const res = await fetch(`${GMAIL_API}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 401) {
      // Token might be expired, clear cache and retry once
      this.tokenCache.delete(account.id);
      const newToken = await this.getAccessToken(account);
      return fetch(`${GMAIL_API}${path}`, {
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
    const afterEpoch = Math.floor(sinceDate.getTime() / 1000);
    const query = `after:${afterEpoch}`;

    // List message IDs
    const listRes = await this.gmailFetch(account, `/messages?q=${encodeURIComponent(query)}&maxResults=${maxMessages}`);
    if (!listRes.ok) {
      throw new Error(`Gmail list messages failed [${listRes.status}]`);
    }

    const listData = (await listRes.json()) as { messages?: Array<{ id: string; threadId: string }> };
    if (!listData.messages?.length) return [];

    // Fetch each message in raw format
    const messages: EmailMessage[] = [];

    for (const msg of listData.messages) {
      try {
        const msgRes = await this.gmailFetch(account, `/messages/${msg.id}?format=full`);
        if (!msgRes.ok) continue;

        const msgData = (await msgRes.json()) as GmailMessage;
        messages.push(this.parseGmailMessage(msgData));
      } catch (err) {
        logger.warn({ accountId: account.id, messageId: msg.id, err: err instanceof Error ? err.message : String(err) }, 'Failed to fetch Gmail message');
      }
    }

    return messages;
  }

  private parseGmailMessage(msg: GmailMessage): EmailMessage {
    const headers = new Map<string, string>();
    for (const h of msg.payload?.headers || []) {
      headers.set(h.name.toLowerCase(), h.value);
    }

    const fromHeader = headers.get('from') || '';
    const fromMatch = fromHeader.match(/(?:"?([^"]*)"?\s)?<?([^>]+)>?/);

    let bodyText = '';
    let bodyHtml = '';
    const attachments: EmailMessage['attachments'] = [];

    this.extractParts(msg.payload, { bodyText: '', bodyHtml: '', attachments });

    // Extract body from parts
    const extracted = { bodyText: '', bodyHtml: '', attachments: [] as EmailMessage['attachments'] };
    this.extractParts(msg.payload, extracted);

    return {
      message_id: headers.get('message-id') || msg.id,
      from_email: fromMatch?.[2] || fromHeader,
      from_name: fromMatch?.[1] || '',
      to_emails: this.parseAddressList(headers.get('to') || ''),
      cc_emails: this.parseAddressList(headers.get('cc') || ''),
      subject: headers.get('subject') || '',
      body_text: extracted.bodyText,
      body_html: extracted.bodyHtml,
      date: new Date(parseInt(msg.internalDate) || Date.now()),
      folder: (msg.labelIds || []).includes('SENT') ? 'SENT' : 'INBOX',
      attachments: extracted.attachments,
      in_reply_to: headers.get('in-reply-to'),
      references: headers.get('references')?.split(/\s+/),
    };
  }

  private extractParts(
    part: GmailPayload | undefined,
    result: { bodyText: string; bodyHtml: string; attachments: EmailMessage['attachments'] },
  ): void {
    if (!part) return;

    if (part.mimeType === 'text/plain' && part.body?.data) {
      result.bodyText = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      result.bodyHtml = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    } else if (part.filename && part.body?.attachmentId) {
      result.attachments.push({
        filename: part.filename,
        content_type: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        content_base64: '', // Attachments fetched separately if needed
      });
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        this.extractParts(subPart, result);
      }
    }
  }

  private parseAddressList(header: string): string[] {
    if (!header) return [];
    return header.split(',').map(addr => {
      const match = addr.match(/<([^>]+)>/);
      return (match?.[1] || addr).trim();
    }).filter(Boolean);
  }

  async sendEmail(account: EmailAccount, params: SendEmailParams): Promise<SendResult> {
    try {
      // Build RFC 2822 message
      const boundary = `boundary_${Date.now()}`;
      const lines: string[] = [];

      lines.push(`From: ${account.email_address}`);
      lines.push(`To: ${params.to.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ')}`);
      if (params.cc?.length) {
        lines.push(`Cc: ${params.cc.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ')}`);
      }
      lines.push(`Subject: ${params.subject}`);
      if (params.reply_to_message_id) {
        lines.push(`In-Reply-To: ${params.reply_to_message_id}`);
        lines.push(`References: ${params.reply_to_message_id}`);
      }
      lines.push(`MIME-Version: 1.0`);
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('');
      lines.push(params.body_text);
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('');
      lines.push(params.body_html);
      lines.push(`--${boundary}--`);

      const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

      const res = await this.gmailFetch(account, '/messages/send', {
        method: 'POST',
        body: JSON.stringify({ raw }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Gmail send failed [${res.status}]: ${text}` };
      }

      const data = (await res.json()) as { id: string };
      return { success: true, message_id: data.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async testConnection(account: EmailAccount): Promise<TestResult> {
    try {
      const token = await this.getAccessToken(account);

      // Test by fetching profile
      const res = await fetch(`${GMAIL_API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        return { smtp_ok: true, imap_ok: true }; // Gmail API handles both
      }

      const text = await res.text();
      return { smtp_ok: false, imap_ok: false, error: `Gmail API error [${res.status}]: ${text}` };
    } catch (err) {
      return { smtp_ok: false, imap_ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// Gmail API types
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  internalDate: string;
  payload: GmailPayload;
}

interface GmailPayload {
  mimeType: string;
  headers: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPayload[];
  filename?: string;
}
