import type { VideoWithClips } from '@speedora/shared';
import { Film } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { videoStatusBadge } from '@/lib/analytics';
import { formatDuration } from '@/lib/dashboard';

export interface RecentProjectsGridProps {
  videos: VideoWithClips[];
}

const TONE_CLASSES: Record<'good' | 'neutral' | 'bad', string> = {
  good: 'border-emerald-500/40 text-emerald-400',
  neutral: 'border-border text-muted-foreground',
  bad: 'border-rose-500/40 text-rose-400',
};

// At-a-glance summary layer above the existing detailed per-video
// clip-gallery list - clicking a card scrolls to that video's existing
// detail block below (anchored via #video-<id>, see app/dashboard/page.tsx)
// rather than duplicating the publish/schedule/delete state machine that
// already lives there.
export function RecentProjectsGrid({ videos }: RecentProjectsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => {
        const badge = videoStatusBadge(video.status);
        return (
          <a key={video.id} href={`#video-${video.id}`} className="block">
            <Card className="transition-colors hover:border-signal-pink/60">
              <div className="flex aspect-video items-center justify-center rounded-t-lg bg-gradient-to-br from-slate-panel to-bay-black">
                <Film className="h-8 w-8 text-chrome" aria-hidden="true" />
              </div>
              <CardContent className="space-y-1.5 p-4">
                <p className="truncate font-body text-sm text-foreground">
                  {video.title ?? 'Video Tanpa Judul'}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={TONE_CLASSES[badge.tone]}>
                    {badge.label}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDuration(video.durationSeconds)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {video.clips.length} klip
                  </span>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {new Date(video.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </a>
        );
      })}
    </div>
  );
}
