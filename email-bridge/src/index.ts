import { logger } from './utils/logger';
import { getConfig } from './config';
import { SmtpSender } from './smtp/sender';
import { ConnectionTester } from './test/tester';
import { SaasApi } from './api/supabase';
import { IEmailConnector, selectConnector } from './connectors/base';
import { ImapSmtpConnector } from './connectors/imap-smtp';
import { GmailConnector } from './connectors/gmail';
import { OutlookConnector } from './connectors/outlook';
import { UnifiedPoller } from './polling/unified';
import cron from 'node-cron';

async function main() {
  const config = getConfig();
  logger.info({ pollInterval: config.POLL_INTERVAL_MS }, 'Email Bridge starting');

  const api = new SaasApi(config);

  // Register connectors
  const connectors = new Map<string, IEmailConnector>();
  connectors.set('imap-smtp', new ImapSmtpConnector(config.ENCRYPTION_KEY));

  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    connectors.set('gmail', new GmailConnector(
      config.ENCRYPTION_KEY,
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
    ));
    logger.info('Gmail connector registered');
  } else {
    logger.info('Gmail connector skipped (no GOOGLE_CLIENT_ID/SECRET)');
  }

  if (config.MICROSOFT_CLIENT_ID && config.MICROSOFT_CLIENT_SECRET) {
    connectors.set('outlook', new OutlookConnector(
      config.ENCRYPTION_KEY,
      config.MICROSOFT_CLIENT_ID,
      config.MICROSOFT_CLIENT_SECRET,
    ));
    logger.info('Outlook connector registered');
  } else {
    logger.info('Outlook connector skipped (no MICROSOFT_CLIENT_ID/SECRET)');
  }

  const poller = new UnifiedPoller(api, config, connectors);
  const smtpSender = new SmtpSender(api, config);
  const tester = new ConnectionTester(api, config);

  async function tick() {
    try {
      await tester.processPendingTests();
      await poller.pollAllAccounts();
      await smtpSender.processOutbox();
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Tick error');
    }
  }

  await tick();

  const intervalSec = Math.max(10, Math.floor(config.POLL_INTERVAL_MS / 1000));
  const cronExpr = intervalSec < 60
    ? `*/${intervalSec} * * * * *`
    : `*/${Math.floor(intervalSec / 60)} * * * *`;

  cron.schedule(cronExpr, tick);
  logger.info({ cronExpr, connectors: Array.from(connectors.keys()) }, 'Cron scheduled');

  const shutdown = () => {
    logger.info('Shutting down...');
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err: err instanceof Error ? err.message : String(err) }, 'Fatal startup error');
  process.exit(1);
});
