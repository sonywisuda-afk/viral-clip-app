export interface YouTubeVideoStats {
  viewCount: number;
  // Null if the creator disabled public like/comment counts for the video -
  // not an error, just missing data.
  likeCount: number | null;
  commentCount: number | null;
}

// Plain fetch() against the YouTube Data API, same pattern as
// fetchChannelInfo() in youtube-oauth.client.ts (a single simple GET
// doesn't need the heavier googleapis SDK that uploadYouTubeVideo() uses
// for its more complex media-upload call). Used by sync-publish-stats.worker.ts
// (Fase 6e) to refresh view/like/comment counts for a published clip.
export async function fetchYouTubeVideoStats(
  accessToken: string,
  videoId: string,
): Promise<YouTubeVideoStats> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'statistics');
  url.searchParams.set('id', videoId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`YouTube videos.list (statistics) failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as {
    items?: Array<{
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    }>;
  };
  const stats = body.items?.[0]?.statistics;
  if (!stats) {
    throw new Error(`No YouTube video found for id ${videoId}`);
  }
  // The API returns these as strings, not numbers.
  return {
    viewCount: Number(stats.viewCount ?? 0),
    likeCount: stats.likeCount !== undefined ? Number(stats.likeCount) : null,
    commentCount: stats.commentCount !== undefined ? Number(stats.commentCount) : null,
  };
}
