import { logger } from '../utils/logger';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh a Google OAuth2 access token using a refresh token.
 */
export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, 'Google token refresh failed');
    throw new Error(`Google token refresh failed [${res.status}]: ${text}`);
  }

  return (await res.json()) as GoogleTokens;
}
