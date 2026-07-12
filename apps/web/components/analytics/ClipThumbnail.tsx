// Milestone 5B - reuses ClipCard.tsx's exact "no frame-extraction exists in
// this backend yet" honesty: a neutral placeholder, not a fake preview.
// Single small frame here (not ClipCard's 2-frame filmstrip) - a filmstrip
// doesn't fit a table row. Rendered via CSS backgroundImage, same technique
// LiveReel.tsx already uses for its own thumbnail frames, rather than an
// <img> tag (no <img>/next/image usage exists anywhere else in this app).
const PLACEHOLDER_FRAME_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160"><rect width="90" height="160" fill="#151922"/><polygon points="38,66 38,94 59,80" fill="#A8B0BE" opacity="0.4"/></svg>',
)}`;

export function ClipThumbnail() {
  return (
    <div
      role="img"
      aria-label="Pratinjau belum tersedia"
      className="h-16 w-9 shrink-0 rounded-sm border border-border bg-cover bg-center"
      style={{ backgroundImage: `url("${PLACEHOLDER_FRAME_SRC}")` }}
    />
  );
}
