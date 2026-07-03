import { decryptToken, encryptToken } from './token-encryption';

// A token is refreshed slightly before it actually expires so a caller
// never ends up using something that's about to lapse mid-request (e.g.
// mid-upload for apps/worker's publish-clip job).
const REFRESH_BUFFER_MS = 60_000;

export interface StoredTokens {
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  tokenExpiresAt: Date;
}

export interface ResolvedAccessToken {
  accessToken: string; // plaintext, ready to use
  refreshed: boolean;
  // Only present when refreshed=true - the caller is responsible for
  // persisting these (this module doesn't touch Prisma/the DB directly,
  // so it stays usable from both apps/api and apps/worker without either
  // depending on the other's data-access layer).
  updated?: StoredTokens;
}

// Every platform's OAuth client (YouTubeOAuthClient, TikTokOAuthClient, ...)
// implements this so resolveAccessToken() below can stay platform-agnostic -
// it's the one piece of it every provider's refresh flow has in common,
// regardless of how differently each provider's actual token endpoint works.
export interface OAuthRefreshClient {
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }>;
}

// Shared by apps/api's SocialAccountsService.getValidAccessToken() and
// apps/worker's publish-clip job - both need the exact same "is this
// close to expiring, and if so refresh it" decision, and having it
// duplicated in two apps would risk them silently drifting apart (see
// CLAUDE.md's Fase 6b section for why this whole package exists).
export async function resolveAccessToken(
  stored: StoredTokens,
  client: OAuthRefreshClient,
): Promise<ResolvedAccessToken> {
  if (stored.tokenExpiresAt.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return { accessToken: decryptToken(stored.accessToken), refreshed: false };
  }

  const refreshed = await client.refreshAccessToken(decryptToken(stored.refreshToken));
  return {
    accessToken: refreshed.accessToken,
    refreshed: true,
    updated: {
      accessToken: encryptToken(refreshed.accessToken),
      refreshToken: encryptToken(refreshed.refreshToken),
      tokenExpiresAt: refreshed.expiresAt,
    },
  };
}
