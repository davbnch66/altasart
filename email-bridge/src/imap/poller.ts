import { SaasApi } from '../api/supabase';
import { BridgeConfig } from '../config';
import { buildImapConfig, fetchNewEmails } from './connector';
import { parseRawEmail, ParsedEmail } from '../utils/parser';
import { logger } from '../utils/logger';

/**
 * Track synced message IDs per account to avoid duplicates within a session.
 * On restart, the SaaS DB unique constraint (email_account_id, message_id) prevents dups.
 */
const syncedMessageIds = new Map<string, Set<string>>();

export class ImapPoller {
  private api: SaasApi;
  private config: BridgeConfig;

  constructor(api: SaasApi, config: BridgeConfig) {
    this.api = api;
    this.config = config;
  }

  async pollAllAccounts(): Promise<void> {
    // We get active accounts via the test poll endpoint (which returns accounts with specific statuses)
    // For regular polling, we use the sync endpoint to get accounts list
    // Actually, we need a way to get active accounts. Let's use the test endpoint with a special query.
    // The bridge knows accounts from the outbox poll (which includes account info).
    // Better approach: fetch accounts from a dedicated endpoint.
    
    // For now, we use the test poll to get accounts that need testing,
    // and the sync push to handle accounts we know about.
    // The actual list of accounts comes from a separate poll.

    try {
      const res = await fetch(`${this.config.SUPABASE_FUNCTIONS_URL}/email-bridge-accounts?action=list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Secret': this.config.EMAIL_BRIDGE_SECRET,
        },
      });

      if (!res.ok) {
        // Fallback: if endpoint doesn't exist yet, skip
        if (res.status === 404) {
          logger.debug('email-bridge-accounts endpoint not found, skipping IMAP poll');
          return;
        }
        throw new Error(`Account list failed [${res.status}]`);
      }

      const data = await res.json();
      const accounts = data.accounts || [];

      for (const account of accounts) {
        if (!account.sync_enabled) continue;
        await this.pollAccount(account);
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Poll all accounts error');
    }
  }

  private async pollAccount(account: any): Promise<void> {
    const accountLog = { accountId: account.id, email: account.email_address };

    try {
      const imapConfig = buildImapConfig(account, this.config.ENCRYPTION_KEY);
      if (!imapConfig) {
        logger.warn(accountLog, 'Skipping account: missing IMAP config');
        return;
      }

      // Calculate since date
      const sinceDate = account.last_sync_at
        ? new Date(account.last_sync_at)
        : new Date(Date.now() - this.config.IMAP_FETCH_DAYS_BACK * 24 * 60 * 60 * 1000);

      logger.info({ ...accountLog, since: sinceDate.toISOString() }, 'Polling IMAP');

      const rawMessages = await fetchNewEmails(
        imapConfig,
        sinceDate,
        this.config.MAX_EMAILS_PER_SYNC,
      );

      if (rawMessages.length === 0) {
        logger.debug(accountLog, 'No new emails');
        return;
      }

      // Parse and deduplicate
      const knownIds = syncedMessageIds.get(account.id) || new Set<string>();
      const newEmails: ParsedEmail[] = [];

      for (const { raw } of rawMessages) {
        try {
          const parsed = await parseRawEmail(raw, 'INBOX');
          if (!knownIds.has(parsed.message_id)) {
            newEmails.push(parsed);
            knownIds.add(parsed.message_id);
          }
        } catch (parseErr) {
          logger.warn(
            { ...accountLog, err: parseErr instanceof Error ? parseErr.message : String(parseErr) },
            'Failed to parse email, skipping',
          );
        }
      }

      // Keep the set bounded
      if (knownIds.size > 10000) {
        const arr = Array.from(knownIds);
        syncedMessageIds.set(account.id, new Set(arr.slice(-5000)));
      } else {
        syncedMessageIds.set(account.id, knownIds);
      }

      if (newEmails.length === 0) {
        logger.debug(accountLog, 'All emails already synced');
        return;
      }

      // Push to SaaS
      const result = await this.api.pushSyncedEmails(account.id, newEmails.map(e => ({
        ...e,
        direction: 'inbound',
      })));

      logger.info(
        { ...accountLog, total: rawMessages.length, new: newEmails.length, ...result },
        'IMAP sync complete',
      );
    } catch (err) {
      logger.error(
        { ...accountLog, err: err instanceof Error ? err.message : String(err) },
        'Account poll error',
      );
    }
  }
}
