'use client';

import type { ExportJobDto } from '@speedora/shared';
import { EXPORT_TYPES, latestJobByType } from '@/lib/export';
import { ExportTypeRow } from './ExportTypeRow';

export function ReportsTab({ videoId, jobs }: { videoId: string; jobs: ExportJobDto[] }) {
  const latestByType = latestJobByType(jobs);

  return (
    <div className="space-y-2">
      {EXPORT_TYPES.map((type) => (
        <ExportTypeRow
          key={type}
          videoId={videoId}
          type={type}
          initialJob={latestByType[type] ?? null}
        />
      ))}
    </div>
  );
}
