import { SaasApi, EmailAccount } from '../api/supabase';
import { BridgeConfig } from '../config';
import { IEmailConnector, selectConnector } from '../connectors/base';
import { logger } from '../utils/logger';

/**
 * Track synced message IDs per account to avoid duplicates within a session.
 */
const syncedMessageIds = new Map<string, Set<string>>();

export class UnifiedPoller {
  private api: SaasApi;
  private config: BridgeConfig;
  private connectors: Map<string, IEmailConnector>;

  constructor(api: SaasApi, config: BridgeConfig, connectors: Map<string, IEmailConnector>) {
    this.api = api;
    this.config = config;
    this.connectors = connectors;
  }

  async pollAllAccounts(): Promise<void> {
    try {
      const res = await fetch(`${this.config.SUPABASE_FUNCTIONS_URL}/email-bridge-accounts?action=list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Secret': this.config.EMAIL_BRIDGE_SECRET,
        },
      });

      if (!res.ok) {
        if (res.status === 404) {
          logger.debug('email-bridge-accounts endpoint not found, skipping');
          return;
        }
        throw new Error(`Account list failed [${res.status}]`);
      }

      const data = (await res.json()) as { accounts?: EmailAccount[] };
      const accounts = data.accounts || [];

      for (const account of accounts) {
        if (!account.sync_enabled) continue;
        await this.pollAccount(account);
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Poll all accounts error');
    }
  }

  private async pollAccount(account: EmailAccount): Promise<void> {
    const accountLog = { accountId: account.id, email: account.email_address, provider: account.provider, auth_method: account.auth_method };

    try {
      // Select the right connector
      const connector = selectConnector(account, this.connectors);
      logger.info({ ...accountLog, connector: connector.type }, 'Polling with connector');

      // Calculate since date
      const sinceDate = account.last_sync_at
        ? new Date(account.last_sync_at)
        : new Date(Date.now() - this.config.IMAP_FETCH_DAYS_BACK * 24 * 60 * 60 * 1000);

      const messages = await connector.fetchEmails(account, sinceDate, this.config.MAX_EMAILS_PER_SYNC);

      if (messages.length === 0) {
        logger.debug(accountLog, 'No new emails');
        return;
      }

      // Deduplicate
      const knownIds = syncedMessageIds.get(account.id) || new Set<string>();
      const newMessages = messages.filter(m => {
        if (knownIds.has(m.message_id)) return false;
        knownIds.add(m.message_id);
        return true;
      });

      // Keep the set bounded
      if (knownIds.size > 10000) {
        const arr = Array.from(knownIds);
        syncedMessageIds.set(account.id, new Set(arr.slice(-5000)));
      } else {
        syncedMessageIds.set(account.id, knownIds);
      }

      if (newMessages.length === 0) {
        logger.debug(accountLog, 'All emails already synced');
        return;
      }

      // Push to SaaS
      const result = await this.api.pushSyncedEmails(account.id, newMessages.map(m => ({
        message_id: m.message_id,
        from_email: m.from_email,
        from_name: m.from_name,
        to_emails: m.to_emails,
        cc_emails: m.cc_emails,
        subject: m.subject,
        body_text: m.body_text,
        body_html: m.body_html,
        date: m.date.toISOString(),
        folder: m.folder,
        direction: 'inbound',
        attachments: m.attachments,
        in_reply_to: m.in_reply_to,
        references: m.references,
      })));

      logger.info(
        { ...accountLog, total: messages.length, new: newMessages.length, ...result },
        'Sync complete',
      );
    } catch (err) {
      logger.error(
        { ...accountLog, err: err instanceof Error ? err.message : String(err) },
        'Account poll error',
      );
    }
  }
}
