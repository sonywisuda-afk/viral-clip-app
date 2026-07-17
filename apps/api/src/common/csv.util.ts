// RFC 4180-ish escaping - only quotes a field when it actually contains a
// comma/quote/newline, same "don't over-engineer" posture as every other
// small pure helper in this codebase (no csv library exists anywhere in the
// monorepo). Extracted from dashboard-export.util.ts once a second/third CSV
// exporter (video report, clip metadata) needed the identical logic.
export function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsvRow(fields: Array<string | number>): string {
  return fields.map(csvEscape).join(',');
}

// Excel's CSV importer ignores the HTTP Content-Type charset entirely and
// falls back to the system codepage unless the file itself starts with a
// UTF-8 BOM - without this, any non-ASCII text (e.g. an Indonesian video
// title/transcript) reads as mojibake once opened in Excel, even though the
// bytes on the wire are correct UTF-8. Plain text formats (JSON/TXT/SRT/VTT)
// don't need this - only CSV, and only because of this one consumer's
// specific quirk.
export function withUtf8Bom(csv: string): string {
  return '﻿' + csv;
}
