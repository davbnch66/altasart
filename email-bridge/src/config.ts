export interface BridgeConfig {
  SUPABASE_FUNCTIONS_URL: string;
  EMAIL_BRIDGE_SECRET: string;
  ENCRYPTION_KEY: string;
  POLL_INTERVAL_MS: number;
  MAX_EMAILS_PER_SYNC: number;
  IMAP_FETCH_DAYS_BACK: number;
}

export function getConfig(): BridgeConfig {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  return {
    SUPABASE_FUNCTIONS_URL: required('SUPABASE_FUNCTIONS_URL'),
    EMAIL_BRIDGE_SECRET: required('EMAIL_BRIDGE_SECRET'),
    ENCRYPTION_KEY: required('ENCRYPTION_KEY'),
    POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
    MAX_EMAILS_PER_SYNC: parseInt(process.env.MAX_EMAILS_PER_SYNC || '50', 10),
    IMAP_FETCH_DAYS_BACK: parseInt(process.env.IMAP_FETCH_DAYS_BACK || '7', 10),
  };
}
