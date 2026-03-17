import { ImapFlow, FetchMessageObject } from 'imapflow';
import { logger } from '../utils/logger';
import { safeDecrypt } from '../utils/crypto';
import { EmailAccount } from '../api/supabase';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}

export function buildImapConfig(account: EmailAccount, encryptionKey: string): ImapConfig | null {
  if (!account.imap_host || !account.imap_username) return null;

  const password = safeDecrypt(account.imap_password_encrypted, encryptionKey);
  if (!password) return null;

  return {
    host: account.imap_host,
    port: account.imap_port || 993,
    secure: (account.imap_security || 'SSL').toUpperCase() !== 'NONE',
    auth: {
      user: account.imap_username,
      pass: password,
    },
  };
}

export async function fetchNewEmails(
  config: ImapConfig,
  sinceDate: Date,
  maxMessages: number,
  folder: string = 'INBOX',
): Promise<{ uid: number; raw: Buffer }[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
    emitLogs: false,
  });

  const results: { uid: number; raw: Buffer }[] = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock(folder);
    try {
      // Search for messages since the given date
      const searchCriteria = { since: sinceDate };
      const uids: number[] = [];

      for await (const msg of client.fetch(searchCriteria, { uid: true })) {
        uids.push(msg.uid);
      }

      if (uids.length === 0) return [];

      // Fetch only the most recent N
      const recentUids = uids.slice(-maxMessages);

      for await (const msg of client.fetch(
        { uid: recentUids.join(',') },
        { uid: true, source: true },
      )) {
        if (msg.source) {
          results.push({ uid: msg.uid, raw: msg.source });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    logger.error(
      { host: config.host, err: err instanceof Error ? err.message : String(err) },
      'IMAP fetch error',
    );
    try { await client.logout(); } catch { /* ignore */ }
    throw err;
  }

  return results;
}

/**
 * Test IMAP connection by connecting and listing folders
 */
export async function testImapConnection(config: ImapConfig): Promise<{ ok: boolean; error?: string }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
    emitLogs: false,
  });

  try {
    await client.connect();
    await client.list();
    await client.logout();
    return { ok: true };
  } catch (err) {
    try { await client.logout(); } catch { /* ignore */ }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
