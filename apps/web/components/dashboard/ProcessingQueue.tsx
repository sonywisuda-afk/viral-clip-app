import { VideoStatus, type VideoWithClips } from '@speedora/shared';
import { Card, CardContent } from '@/components/ui/card';
import { videoProcessingStage } from '@/lib/dashboard';

export interface ProcessingQueueProps {
  videos: VideoWithClips[];
}

// Filters the dashboard's already-polled listVideos() data down to
// in-progress videos - no separate endpoint, since GET /videos (already
// polled every 2s by the page) already carries everything
// videoProcessingStage needs. "Realtime" here means poll-driven, same as
// the rest of this app (no WebSocket/SSE infra exists anywhere yet).
export function ProcessingQueue({ videos }: ProcessingQueueProps) {
  const inProgress = videos.filter(
    (video) => video.status !== VideoStatus.RENDERED && video.status !== VideoStatus.FAILED,
  );

  if (inProgress.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="font-display text-sm uppercase tracking-wide text-muted-foreground">
        Antrean Proses
      </h2>
      {inProgress.map((video) => {
        const stage = videoProcessingStage(video);
        return (
          <Card key={video.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-body text-sm text-foreground">
                  {video.title ?? 'Video Tanpa Judul'}
                </p>
                <span className="font-mono text-xs text-muted-foreground">{stage.label}</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-panel">
                <div
                  className="h-full rounded-full bg-signal-cyan transition-all"
                  style={{ width: `${stage.percent}%` }}
                />
              </div>
              <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
                {stage.percent}%
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
