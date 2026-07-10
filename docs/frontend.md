# Frontend (`apps/web`)

Next.js + TypeScript. Talks to `apps/api` only over HTTP (`lib/api.ts`), never imports backend
code directly.

## Routes

- `/` — engine-choice screen (Groq vs. OpenAI Whisper, per-video not per-account — see
  `ai/llm.md`) then upload/YouTube-import + live `ProcessingStatus` for the just-submitted video.
- `/dashboard` — history of all videos owned by the user (`GET /videos`), Clip Gallery per video:
  inline preview (`clipStreamUrl`), download, publish-to-platform controls, hookText/hashtags,
  Content Intelligence panel (scores/reason/topics), links to Timeline Editor and OCR Review when
  applicable.
- `/videos/:id/edit` — Timeline Editor.
- `/videos/:id/ocr-review` — OCR dataset annotation tool (standalone, deliberately separate from
  the Timeline Editor — different workflow/audience).
- `/accounts` — connected social accounts (connect/disconnect/reconnect).
- `/social` — (publish-adjacent UI, see `backend.md`'s Publish Center).

All routes gate on `lib/useAuth.ts` (`GET /auth/me`), not `localStorage` — session state always
reflects the server.

## Timeline Editor (`TimelineEditor.tsx`, `lib/timelineStore.ts`)

- **Preview**: `<video>` streaming the *source* (`GET /videos/:id/source`, Range-enabled,
  `crossOrigin="use-credentials"`) — not the rendered output — with a `<canvas>` overlay
  redrawn on `requestAnimationFrame` for captions. Deliberately **approximate**, not pixel-perfect
  vs. the libass burn-in (plain bold white text regardless of `captionStyle`) — building a shared
  style engine between canvas and FFmpeg's ASS renderer is out of scope.
- **Timeline**: absolutely-positioned/percentage `<div>`s (not SVG/canvas) for the clip track (drag
  handles for start/end) and a read-only caption track. Speaker-color-coded transcript strip
  (Diarization) and per-word emotion emoji tags (Vocal Emotion) — see `ai/audio.md`.
- **State**: Zustand (`lib/timelineStore.ts`) — clips + draft trim + per-clip dirty/saving/
  rendering flags, plus editable hookText/hashtags (uncontrolled `<input>`s, `key={clipId}` +
  `defaultValue` + commit on blur — a controlled value re-derived every keystroke would eat
  trailing spaces/commas).
- **Trim/caption-style edits do not auto-render** — `PATCH /clips/:id` only updates the DB; the
  user must click "Render" (`POST /clips/:id/render`) explicitly.
- **`VideoAnalysisDashboard.tsx`** sits above the editor — heatmap (opacity by `viralityScore`
  across clip time ranges, not a continuous per-second score), best-clip ranking, average score
  breakdown, topic/intent distribution — built entirely from data already on `TimelineClip`, no new
  API calls.

## Dashboard (`app/dashboard/page.tsx`)

Polls `GET /videos` every 2s. Clip preview `<video>` uses `clipStreamUrl(clip.id)` →
`GET /clips/:id/stream` (Range-enabled inline stream), not `clipDownloadUrl` (attachment header,
can't play in a `<video>` element). Clip delete is **optimistic** — the row disappears immediately
on click; on a failed request it re-fetches the real list (`listVideos()`) rather than restoring a
stale snapshot, since a poll may have moved state in the meantime. "OCR Review" link appears only
when at least one clip has `ocrTracks`.

## OCR Review (`components/OcrReviewer.tsx`)

Standalone annotation UI for building an OCR classifier evaluation dataset (see `ai/ocr.md`).
Local `useState`, not a shared store — no cross-page persistence needed. Shares the `<video>` +
`<canvas>` overlay pattern with the Timeline Editor (bounding boxes normalized against the source
frame dimensions, drawn on a stretched-to-16:9 canvas). Review progress lives in `localStorage`
(`speedora:ocr-review:<videoId>`) — this is internal tooling, not an end-user feature, so no
backend persistence. Keyboard-driven for throughput: `1`–`6` selects a pending category, `Enter`
commits + advances to the next unreviewed track (auto-seeking the video to that track's start
time), `Shift+Enter` navigates back without committing. "Export JSON" produces a file matching
`@speedora/contracts`'s `ocrLabeledTrackSchema`, consumable directly by
`apps/worker`'s `pnpm evaluate:ocr` CLI (see `ai/ocr.md`, `testing.md`).

## Processing status UX (`components/processing/ProcessingStatus.tsx`)

Progress bar spans all three visible stages (Transcribe/Auto-Clip/Render), filled by real
checkpoints:

- Transcribe: `video.transcribeProgress`.
- Render & Caption: fraction of `video.clips` with `downloadUrl !== null` (already in the polled
  `GET /videos` payload — no new endpoint needed).
- A standalone IMPORTING screen (separate 0–99 range, not part of the 3-stage bar) shows
  `video.importProgress`, real yt-dlp download percentage.

On top of real checkpoints, a "creep" animation nudges the displayed percentage +1%/second toward
the current stage's ceiling while waiting for the next real checkpoint — capped so it can never
cross a stage boundary itself; only an actual status change unlocks the next stage. This is a
deliberate, narrow exception to the "never fabricate progress" principle applied to the raw
progress values elsewhere in the codebase (see `coding-standards.md`) — it only smooths perceived
motion between two already-real data points, it never invents a stage completion.

## Global UI polish

Every interactive control (`<button>`, `role="button"`, `<a>`, the styled `Button` component
including `asChild`) gets a universal pressed-state visual (scale-down + brightness/color pop) —
a global base-layer CSS rule (`app/globals.css`) for raw elements, complemented by `active:*`
Tailwind classes per `Button` variant for variant-specific color shifts.
