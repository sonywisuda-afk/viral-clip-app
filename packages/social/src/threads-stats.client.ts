import { THREADS_GRAPH_BASE_URL } from './threads-graph';

export interface ThreadsPostStats {
  viewCount: number | null;
  likeCount: number | null;
  // Threads calls comments "replies" - mapped onto this shared shape's
  // commentCount, same terminology-normalization precedent as TikTok's
  // publish_id/media id differences elsewhere in this package.
  commentCount: number | null;
  // Reposts are the closest Threads-native analog to a "share" - a
  // separate `quotes` metric exists too (a repost with added commentary)
  // but isn't folded in here, same "map what maps cleanly" posture as
  // Facebook's null shareCount.
  shareCount: number | null;
  // Threads has no watch-time metric (it's a mixed text/image/video feed,
  // not a video-first platform) - always null, same shape as TikTok's null
  // watch-time for a different reason.
  watchTimeSeconds: number | null;
}

const METRICS = ['views', 'likes', 'replies', 'reposts'];

interface ThreadsErrorBody {
  error?: { message?: string } | string;
}

function errorMessageOf(body: ThreadsErrorBody): string {
  if (typeof body.error === 'string') return body.error;
  return body.error?.message ?? '';
}

// Used by sync-publish-stats.worker.ts to refresh view/like/reply/repost
// counts for a published Threads post. Requires the threads_basic scope
// (insights are available under the same permission - see
// threads-oauth.client.ts's SCOPES).
export async function fetchThreadsPostStats(
  accessToken: string,
  threadsPostId: string,
): Promise<ThreadsPostStats> {
  const url = new URL(`${THREADS_GRAPH_BASE_URL}/${threadsPostId}/insights`);
  url.searchParams.set('metric', METRICS.join(','));
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url);
  const body = (await res.json()) as {
    data?: Array<{ name: string; values?: Array<{ value: number }> }>;
  } & ThreadsErrorBody;
  if (!res.ok || body.error) {
    throw new Error(`Threads media insights failed: ${res.status} ${errorMessageOf(body)}`.trim());
  }

  function valueFor(name: string): number | null {
    const metric = body.data?.find((m) => m.name === name);
    const value = metric?.values?.[0]?.value;
    return typeof value === 'number' ? value : null;
  }

  return {
    viewCount: valueFor('views'),
    likeCount: valueFor('likes'),
    commentCount: valueFor('replies'),
    shareCount: valueFor('reposts'),
    watchTimeSeconds: null,
  };
}
