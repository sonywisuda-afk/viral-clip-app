// Internal to packages/social (not exported via index.ts) - shared by
// threads-oauth.client.ts, threads-upload.client.ts, and
// threads-stats.client.ts. Threads is a SEPARATE Meta product/host from the
// Instagram/Facebook Graph API (see meta-graph.ts) - graph.threads.net, its
// own app registration, its own OAuth screen at threads.net (not
// facebook.com/dialog/oauth). Bump GRAPH_API_VERSION as Meta deprecates old
// Threads API versions.
export const THREADS_API_VERSION = 'v1.0';
export const THREADS_GRAPH_BASE_URL = `https://graph.threads.net/${THREADS_API_VERSION}`;
// The two OAuth token endpoints (exchange code -> short-lived,
// short-lived -> long-lived, long-lived -> refreshed long-lived) are
// unversioned per Meta's docs, unlike the resource endpoints above.
export const THREADS_OAUTH_BASE_URL = 'https://graph.threads.net';
export const THREADS_AUTHORIZE_URL = 'https://threads.net/oauth/authorize';
