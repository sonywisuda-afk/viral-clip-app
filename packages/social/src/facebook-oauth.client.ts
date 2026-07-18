import { OAuthNotConfiguredError } from './errors';
import { GRAPH_API_VERSION, GRAPH_BASE_URL } from './meta-graph';
import type { OAuthRefreshClient } from './resolve-access-token';

const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

// Multi-Platform Publishing Expansion, Phase 1. Reuses the exact same
// Facebook Login OAuth app as Instagram (instagram-oauth.client.ts) - same
// FACEBOOK_APP_ID/APP_SECRET env vars, same classic Facebook Login flow -
// just requesting the additional Page-publishing scopes alongside
// Instagram's. pages_manage_posts is what publish-clip.worker.ts needs to
// publish a Reel to the Page; pages_read_engagement is what
// sync-publish-stats.worker.ts needs for Page video insights;
// pages_show_list is needed to look up which Facebook Page the user
// manages, same reasoning as Instagram's identical scope.
const SCOPES = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'];

export interface FacebookTokens {
  accessToken: string; // long-lived USER access token (NOT the Page token used for API calls)
  expiresAt: Date;
}

export interface FacebookPage {
  pageId: string; // Facebook Page id - stored as SocialAccount.platformAccountId
  pageName: string;
  pageAccessToken: string; // the token actually used for video_reels API calls
}

interface FacebookCredentials {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

// Same FACEBOOK_APP_ID/APP_SECRET as Instagram (instagram-oauth.client.ts) -
// one Meta app covers both products. Optional at boot, same treatment as
// every other platform's credentials (see CLAUDE.md's Fase 6a/6d).
function requireCredentials(): FacebookCredentials {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new OAuthNotConfiguredError('Facebook integration is not configured');
  }
  const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`;
  return {
    appId,
    appSecret,
    // Must exactly match a redirect URI registered on the Meta app - a
    // DIFFERENT registered redirect URI than Instagram's, even though it's
    // the same app, since apps/api's social.controller.ts routes each
    // platform through its own :platform segment.
    redirectUri: `${apiBaseUrl}/social/facebook/callback`,
  };
}

interface GraphTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface GraphErrorResponse {
  error?: { message?: string; type?: string; code?: number };
}

async function graphGet<T>(url: URL): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json()) as T & GraphErrorResponse;
  if (!res.ok || body.error) {
    throw new Error(
      `Facebook Graph API request failed: ${res.status} ${body.error?.message ?? ''}`.trim(),
    );
  }
  return body;
}

// Same "no official Meta Node SDK" reasoning as instagram-oauth.client.ts -
// hand-rolled via fetch().
export class FacebookOAuthClient implements OAuthRefreshClient {
  buildAuthorizeUrl(state: string): string {
    const { appId, redirectUri } = requireCredentials();
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  // Same short-lived -> long-lived user token exchange as Instagram - Meta's
  // Graph API doesn't hand out a classic OAuth refresh_token for this flow.
  async exchangeCode(code: string): Promise<FacebookTokens> {
    const { appId, appSecret, redirectUri } = requireCredentials();
    const shortLivedUrl = new URL(`${GRAPH_BASE_URL}/oauth/access_token`);
    shortLivedUrl.searchParams.set('client_id', appId);
    shortLivedUrl.searchParams.set('client_secret', appSecret);
    shortLivedUrl.searchParams.set('redirect_uri', redirectUri);
    shortLivedUrl.searchParams.set('code', code);
    const shortLived = await graphGet<GraphTokenResponse>(shortLivedUrl);

    return this.exchangeForLongLivedToken(shortLived.access_token);
  }

  private async exchangeForLongLivedToken(token: string): Promise<FacebookTokens> {
    const { appId, appSecret } = requireCredentials();
    const url = new URL(`${GRAPH_BASE_URL}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', token);
    const longLived = await graphGet<GraphTokenResponse>(url);

    return {
      accessToken: longLived.access_token,
      expiresAt: new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 60 * 60) * 1000),
    };
  }

  // Picks the FIRST Page the user manages - same "revisit with a picker UI
  // if needed" call as Instagram's fetchAccountInfo().
  async fetchAccountInfo(userAccessToken: string): Promise<FacebookPage> {
    const url = new URL(`${GRAPH_BASE_URL}/me/accounts`);
    url.searchParams.set('fields', 'id,name,access_token');
    url.searchParams.set('access_token', userAccessToken);
    const body = await graphGet<{
      data?: Array<{ id: string; name: string; access_token: string }>;
    }>(url);

    const page = body.data?.[0];
    if (!page) {
      throw new Error('No Facebook Page found - this user must manage at least one Page');
    }
    return { pageId: page.id, pageName: page.name, pageAccessToken: page.access_token };
  }

  // The stored `refreshToken` is the previously-issued long-lived USER
  // token (see SocialAccountsService.connectFacebook) - re-exchanging it
  // yields a fresh long-lived user token, from which a fresh Page access
  // token is re-derived the same way exchangeCode() does.
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
    const refreshedUserToken = await this.exchangeForLongLivedToken(refreshToken);
    const page = await this.fetchAccountInfo(refreshedUserToken.accessToken);
    return {
      accessToken: page.pageAccessToken,
      refreshToken: refreshedUserToken.accessToken,
      expiresAt: refreshedUserToken.expiresAt,
    };
  }

  // Best-effort - revokes ALL of this app's permissions for the user, same
  // as Instagram's revokeToken().
  async revokeToken(token: string): Promise<void> {
    const url = new URL(`${GRAPH_BASE_URL}/me/permissions`);
    url.searchParams.set('access_token', token);
    const res = await fetch(url, { method: 'DELETE' });
    const body = (await res.json().catch(() => ({}))) as GraphErrorResponse;
    if (!res.ok || body.error) {
      throw new Error(
        `Facebook permissions revoke failed: ${res.status} ${body.error?.message ?? ''}`.trim(),
      );
    }
  }
}
