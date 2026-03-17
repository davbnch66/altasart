import { logger } from './utils/logger';
import { getConfig } from './config';
import { ImapPoller } from './imap/poller';
import { SmtpSender } from './smtp/sender';
import { ConnectionTester } from './test/tester';
import { SaasApi } from './api/supabase';
import cron from 'node-cron';

async function main() {
  const config = getConfig();
  logger.info({ pollInterval: config.POLL_INTERVAL_MS }, 'Email Bridge starting');

  const api = new SaasApi(config);
  const imapPoller = new ImapPoller(api, config);
  const smtpSender = new SmtpSender(api, config);
  const tester = new ConnectionTester(api, config);

  async function tick() {
    try {
      // 1. Process test requests
      await tester.processPendingTests();

      // 2. Poll IMAP for all active accounts
      await imapPoller.pollAllAccounts();

      // 3. Send queued outbound emails
      await smtpSender.processOutbox();
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Tick error');
    }
  }

  // Initial tick
  await tick();

  // Schedule recurring ticks
  const intervalSec = Math.max(10, Math.floor(config.POLL_INTERVAL_MS / 1000));
  const cronExpr = intervalSec < 60
    ? `*/${intervalSec} * * * * *`
    : `*/${Math.floor(intervalSec / 60)} * * * *`;

  cron.schedule(cronExpr, tick);
  logger.info({ cronExpr }, 'Cron scheduled');

  // Graceful shutdown
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
