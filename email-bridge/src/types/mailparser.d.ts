declare module 'mailparser' {
  import { Readable } from 'stream';

  interface AddressObject {
    value: Array<{ address: string; name: string }>;
    html: string;
    text: string;
  }

  interface Attachment {
    filename?: string;
    contentType: string;
    size: number;
    content: Buffer;
    contentDisposition?: string;
    contentId?: string;
    related?: boolean;
  }

  interface ParsedMail {
    messageId?: string;
    from?: AddressObject;
    to?: AddressObject | AddressObject[];
    cc?: AddressObject | AddressObject[];
    bcc?: AddressObject | AddressObject[];
    subject?: string;
    text?: string;
    html?: string | false;
    date?: Date;
    attachments: Attachment[];
    headers: Map<string, string>;
  }

  function simpleParser(
    source: string | Buffer | Readable,
  ): Promise<ParsedMail>;

  export { simpleParser, ParsedMail, Attachment, AddressObject };
}
