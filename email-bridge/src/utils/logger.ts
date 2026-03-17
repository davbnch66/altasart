import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  redact: {
    paths: [
      'smtp_password_encrypted',
      'imap_password_encrypted',
      'password',
      'smtp_password',
      'imap_password',
      'oauth_access_token_encrypted',
      'oauth_refresh_token_encrypted',
      '*.smtp_password_encrypted',
      '*.imap_password_encrypted',
      '*.password',
      'email_accounts.smtp_password_encrypted',
      'email_accounts.imap_password_encrypted',
    ],
    censor: '[REDACTED]',
  },
});
