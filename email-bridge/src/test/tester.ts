import { SaasApi, EmailAccount } from '../api/supabase';
import { BridgeConfig } from '../config';
import { buildImapConfig, testImapConnection } from '../imap/connector';
import { logger } from '../utils/logger';
import { safeDecrypt } from '../utils/crypto';
import nodemailer from 'nodemailer';

export class ConnectionTester {
  private api: SaasApi;
  private config: BridgeConfig;

  constructor(api: SaasApi, config: BridgeConfig) {
    this.api = api;
    this.config = config;
  }

  async processPendingTests(): Promise<void> {
    try {
      const accounts = await this.api.pollTestRequests();
      if (accounts.length === 0) return;

      logger.info({ count: accounts.length }, 'Processing test requests');

      for (const account of accounts) {
        await this.testAccount(account);
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Test processing error');
    }
  }

  private async testAccount(account: EmailAccount): Promise<void> {
    const accountLog = { accountId: account.id, email: account.email_address };
    let smtpOk = false;
    let imapOk = false;
    const errors: string[] = [];

    // Test SMTP
    if (account.smtp_host) {
      try {
        const password = safeDecrypt(account.smtp_password_encrypted, this.config.ENCRYPTION_KEY);
        if (!password) {
          errors.push('SMTP: mot de passe manquant');
        } else {
          const security = (account.smtp_security || 'STARTTLS').toUpperCase();
          const transportConfig: any = {
            host: account.smtp_host,
            port: account.smtp_port || 587,
            secure: security === 'SSL',
            auth: {
              user: account.smtp_username || account.email_address,
              pass: password,
            },
            connectionTimeout: 10000,
          };

          if (security === 'STARTTLS') {
            transportConfig.secure = false;
            transportConfig.requireTLS = true;
          }

          const transporter = nodemailer.createTransport(transportConfig);
          await transporter.verify();
          transporter.close();
          smtpOk = true;
          logger.info(accountLog, 'SMTP test OK');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`SMTP: ${msg}`);
        logger.warn({ ...accountLog, err: msg }, 'SMTP test failed');
      }
    } else {
      errors.push('SMTP: serveur non configuré');
    }

    // Test IMAP
    const imapConfig = buildImapConfig(account, this.config.ENCRYPTION_KEY);
    if (imapConfig) {
      const result = await testImapConnection(imapConfig);
      imapOk = result.ok;
      if (!result.ok) {
        errors.push(`IMAP: ${result.error || 'échec de connexion'}`);
        logger.warn({ ...accountLog, err: result.error }, 'IMAP test failed');
      } else {
        logger.info(accountLog, 'IMAP test OK');
      }
    } else {
      errors.push('IMAP: configuration manquante');
    }

    // Report result
    const errorMsg = errors.length > 0 ? errors.join(' | ') : undefined;
    await this.api.reportTestResult(account.id, smtpOk, imapOk, errorMsg);

    logger.info({ ...accountLog, smtpOk, imapOk, errors }, 'Test complete');
  }
}
