'use client';

import { Download } from 'lucide-react';
import { videoExportUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { VIDEO_EXPORT_FORMATS, videoExportFormatLabel } from '@/lib/export';

// Sprint 03e - the 7 sync formats (Sprint 03b) are all plain <a href>
// downloads, no state/polling at all - same convention as
// QuickActions.tsx's "Export Report" button and clipDownloadUrl.
export function QuickDownloadsTab({ videoId }: { videoId: string }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {VIDEO_EXPORT_FORMATS.map((format) => (
        <Button key={format} variant="outline" asChild className="justify-start">
          <a href={videoExportUrl(videoId, format)}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {videoExportFormatLabel(format)}
          </a>
        </Button>
      ))}
    </div>
  );
}
