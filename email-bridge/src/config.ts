export interface BridgeConfig {
  SUPABASE_FUNCTIONS_URL: string;
  EMAIL_BRIDGE_SECRET: string;
  ENCRYPTION_KEY: string;
  POLL_INTERVAL_MS: number;
  MAX_EMAILS_PER_SYNC: number;
  IMAP_FETCH_DAYS_BACK: number;
  // OAuth credentials (optional — only needed if OAuth accounts exist)
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
}

export function getConfig(): BridgeConfig {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
  };

  const optional = (key: string, fallback: string = ''): string => {
    return process.env[key] || fallback;
  };

  return {
    SUPABASE_FUNCTIONS_URL: required('SUPABASE_FUNCTIONS_URL'),
    EMAIL_BRIDGE_SECRET: required('EMAIL_BRIDGE_SECRET'),
    ENCRYPTION_KEY: required('ENCRYPTION_KEY'),
    POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
    MAX_EMAILS_PER_SYNC: parseInt(process.env.MAX_EMAILS_PER_SYNC || '50', 10),
    IMAP_FETCH_DAYS_BACK: parseInt(process.env.IMAP_FETCH_DAYS_BACK || '7', 10),
    GOOGLE_CLIENT_ID: optional('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: optional('GOOGLE_CLIENT_SECRET'),
    MICROSOFT_CLIENT_ID: optional('MICROSOFT_CLIENT_ID'),
    MICROSOFT_CLIENT_SECRET: optional('MICROSOFT_CLIENT_SECRET'),
  };
}
