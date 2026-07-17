// Sprint 03c (Export Center roadmap) - the client-facing shape for an
// ExportJob row. resultUrl is a `/export/:id/download` endpoint path, never
// the raw storage key - same "never the raw key" treatment as every other
// resource in this codebase (Video.thumbnailUrl, Clip.downloadUrl, etc.).
// Null until status reaches READY.
// Real TS enums (not string-literal type unions) - same convention as
// CaptionStyle/TranscriptionProvider in ./video, needed for class-validator's
// @IsEnum() to work against a real runtime object.
export enum ExportType {
  PDF = 'PDF',
  // Sprint 03d - EXCEL/HIGHLIGHT_REPORT/BRAND_REPORT all reuse the exact
  // same video-scoped data pipeline PDF already uses; only the rendering
  // differs. ANALYTICS_REPORT deliberately isn't here yet - it's
  // account-wide, not video-scoped, a bigger separate change (see
  // schema.prisma's ExportType comment).
  EXCEL = 'EXCEL',
  HIGHLIGHT_REPORT = 'HIGHLIGHT_REPORT',
  BRAND_REPORT = 'BRAND_REPORT',
}

export enum ExportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
}

export interface ExportJobDto {
  id: string;
  videoId: string;
  type: ExportType;
  status: ExportJobStatus;
  resultUrl: string | null;
  failReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Recent Exports / Persistent Export History - GET /export?videoId= returns
// up to the 10 most recent jobs for that video, newest first. Wrapped
// (not a bare array), same list-response convention as every other list
// endpoint in this codebase ({ invites: PendingInviteDto[] }, { clips:
// TopClipRow[] }, etc.).
export interface ExportJobListDto {
  jobs: ExportJobDto[];
}
