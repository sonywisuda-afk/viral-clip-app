// Internal to packages/social (not exported via index.ts) - shared by every
// Meta Graph API client (Instagram, and Facebook Reels as of Multi-Platform
// Publishing Expansion Phase 1 - both are the same graph.facebook.com API,
// just different endpoints/permissions). Threads is a *separate* host
// (graph.threads.net, see threads-graph.ts) - not the same product despite
// also being a Meta API. Bump GRAPH_API_VERSION as Meta deprecates old
// Graph API versions.
export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
