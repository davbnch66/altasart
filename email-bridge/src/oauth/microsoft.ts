import { logger } from '../utils/logger';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh a Microsoft OAuth2 access token using a refresh token.
 */
export async function refreshMicrosoftToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<MicrosoftTokens> {
  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, 'Microsoft token refresh failed');
    throw new Error(`Microsoft token refresh failed [${res.status}]: ${text}`);
  }

  return (await res.json()) as MicrosoftTokens;
}
