import { createHash, createHmac } from 'node:crypto';

// Internal to packages/social (not exported via index.ts) - shared by
// x-oauth.client.ts, x-upload.client.ts, and x-stats.client.ts.
export const X_API_BASE_URL = 'https://api.x.com/2';
export const X_OAUTH_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
export const X_OAUTH_TOKEN_URL = 'https://api.x.com/2/oauth2/token';

function base64url(input: Buffer): string {
  return input.toString('base64url');
}

// X's OAuth 2.0 flow requires PKCE (Proof Key for Code Exchange), which
// needs the SAME code_verifier at both buildAuthorizeUrl() and
// exchangeCode() time - two calls in two separate HTTP requests (the
// connect redirect, then the platform's own callback redirect), with no
// server-side session between them in this app's architecture (see
// SocialController - every other platform's OAuthConnectAdapter only needs
// `state`, not a second correlated secret). Rather than adding session
// storage or widening every platform's adapter interface for X's sake
// alone, the code_verifier is deterministically re-derived from the
// already-signed, tamper-proof `state` JWT itself via HMAC-SHA256, keyed on
// JWT_SECRET (already a required env var - see env.validation.ts) - the
// same state string is available at both call sites
// (SocialController.connect signs it; .callback verifies it before calling
// exchangeCode), so both derivations always agree without persisting
// anything new. HMAC output (32 bytes) base64url-encodes to exactly 43
// characters, within PKCE's required 43-128 length and its unreserved
// [A-Za-z0-9-._~] charset (base64url only uses a subset of that).
export function deriveCodeVerifier(state: string): string {
  const secret = process.env.JWT_SECRET ?? '';
  return base64url(createHmac('sha256', secret).update(state).digest());
}

export function deriveCodeChallenge(codeVerifier: string): string {
  return base64url(createHash('sha256').update(codeVerifier).digest());
}
