// Internal to packages/social (not exported via index.ts) - shared by
// instagram-oauth.client.ts, instagram-upload.client.ts, and
// instagram-stats.client.ts, extracted once a 3rd file needed the same
// constant (this project's usual "extract at the 3rd duplication" rule).
// Bump GRAPH_API_VERSION as Meta deprecates old Graph API versions.
export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
