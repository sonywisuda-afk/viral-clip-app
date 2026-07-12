import { Injectable } from '@nestjs/common';
import type { SearchResultsDto } from '@speedora/shared';
import { PrismaService } from '../prisma/prisma.service';

// Bounded so this endpoint can never itself become a slow query - same
// reasoning as AnalyticsService's MAX_CANDIDATE_ROWS/monitoring.md's
// /queues endpoint. A per-category top-N is plenty for a search dropdown.
const MAX_RESULTS_PER_CATEGORY = 10;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // Sprint 1-2 (Dashboard Redesign) - cross-entity search over the three
  // things the Dashboard's search bar promises (video/clip/keyword,
  // transcript). Owner-scoped like every other endpoint in this app -
  // never searches across users. Every query runs in parallel, same
  // "fetch everything at once" convention as AnalyticsService.getOverview.
  async search(userId: string, query: string): Promise<SearchResultsDto> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return { videos: [], clips: [], transcriptMatches: [] };
    }

    const [videos, clips, transcriptSegments] = await Promise.all([
      this.prisma.video.findMany({
        where: { ownerId: userId, title: { contains: trimmed, mode: 'insensitive' } },
        select: { id: true, title: true, createdAt: true },
        take: MAX_RESULTS_PER_CATEGORY,
      }),
      this.prisma.clip.findMany({
        where: {
          video: { ownerId: userId },
          OR: [
            { hookText: { contains: trimmed, mode: 'insensitive' } },
            // Array-equality only (Prisma's `has` on a String[] column has
            // no case-insensitive/substring mode) - matches an exact
            // hashtag, not a partial one. Honest scope for a first search
            // pass, not a full-text-search engine.
            { hashtags: { has: trimmed } },
          ],
        },
        select: { id: true, videoId: true, hookText: true, hashtags: true },
        take: MAX_RESULTS_PER_CATEGORY,
      }),
      this.prisma.transcriptSegment.findMany({
        where: { video: { ownerId: userId }, text: { contains: trimmed, mode: 'insensitive' } },
        select: { videoId: true, start: true, end: true, text: true },
        take: MAX_RESULTS_PER_CATEGORY,
      }),
    ]);

    return {
      videos: videos.map((video) => ({
        videoId: video.id,
        title: video.title,
        createdAt: video.createdAt.toISOString(),
      })),
      clips: clips.map((clip) => ({
        clipId: clip.id,
        videoId: clip.videoId,
        hookText: clip.hookText,
        hashtags: clip.hashtags,
      })),
      transcriptMatches: transcriptSegments.map((segment) => ({
        videoId: segment.videoId,
        start: segment.start,
        end: segment.end,
        text: segment.text,
      })),
    };
  }
}
