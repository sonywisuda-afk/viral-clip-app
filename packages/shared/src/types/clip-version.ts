import type { CaptionStyle } from './video';

// Sprint 5E (Version Compare & History). A snapshot of one clip's
// render/trim-relevant state right before it was superseded by a new
// re-render - see ClipVersion's own schema comment for why only these
// fields (not the deep per-clip AI signal columns) are captured.
// downloadUrl/thumbnailUrl are endpoint paths (never raw storage keys),
// same "never the raw key" treatment as every other resource - both null
// if this version's render never actually finished before being
// superseded.
export interface ClipVersionDto {
  id: string;
  clipId: string;
  versionNumber: number;
  startTime: number;
  endTime: number;
  downloadUrl: string | null;
  thumbnailUrl: string | null;
  captionStyle: CaptionStyle;
  hookText: string | null;
  hashtags: string[];
  viralityScore: number;
  createdByEmail: string;
  createdAt: string;
}

export interface ClipVersionListDto {
  versions: ClipVersionDto[];
}
