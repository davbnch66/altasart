import { simpleParser, ParsedMail, Attachment } from 'mailparser';

export interface ParsedEmail {
  message_id: string;
  from_email: string;
  from_name: string;
  to_emails: Array<{ email: string; name?: string }>;
  cc_emails: Array<{ email: string; name?: string }>;
  subject: string;
  body_text: string;
  body_html: string;
  attachments: Array<{
    filename: string;
    content_type: string;
    size: number;
    content_base64?: string;
  }>;
  received_at: string;
  folder: string;
  raw_headers?: Record<string, string>;
}

function parseAddressList(addr: any): Array<{ email: string; name?: string }> {
  if (!addr) return [];
  const list = Array.isArray(addr.value) ? addr.value : addr.value ? [addr.value] : [];
  return list.map((a: any) => ({
    email: a.address || '',
    name: a.name || undefined,
  })).filter((a: { email: string }) => a.email);
}

export async function parseRawEmail(raw: Buffer, folder: string): Promise<ParsedEmail> {
  const parsed: ParsedMail = await simpleParser(raw);

  const attachments = (parsed.attachments || [])
    .slice(0, 20)
    .map((att: Attachment) => ({
      filename: att.filename || 'attachment',
      content_type: att.contentType || 'application/octet-stream',
      size: att.size || 0,
      // Only include small attachments inline (< 2MB)
      content_base64: att.size && att.size < 2 * 1024 * 1024
        ? att.content.toString('base64')
        : undefined,
    }));

  return {
    message_id: parsed.messageId || `<${Date.now()}@bridge-generated>`,
    from_email: parsed.from?.value?.[0]?.address || '',
    from_name: parsed.from?.value?.[0]?.name || '',
    to_emails: parseAddressList(parsed.to),
    cc_emails: parseAddressList(parsed.cc),
    subject: parsed.subject || '',
    body_text: (parsed.text || '').slice(0, 200000),
    body_html: (parsed.html || '').toString().slice(0, 500000),
    attachments,
    received_at: (parsed.date || new Date()).toISOString(),
    folder,
  };
}
