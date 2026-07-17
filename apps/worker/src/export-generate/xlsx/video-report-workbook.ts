import ExcelJS from 'exceljs';
import type { VideoReportData } from '@speedora/contracts';

const NA = 'n/a';

function fmt(value: string | number | null): string | number {
  return value === null || value === '' ? NA : value;
}

function addOverviewSheet(workbook: ExcelJS.Workbook, report: VideoReportData): void {
  const sheet = workbook.addWorksheet('Overview');
  sheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({ field: 'Video Title', value: fmt(report.cover.videoTitle) });
  sheet.addRow({ field: 'Duration (seconds)', value: fmt(report.videoSummary.durationSeconds) });
  sheet.addRow({ field: 'Clip Count', value: report.videoSummary.clipCount });
  sheet.addRow({
    field: 'Average Highlight Score',
    value: fmt(report.videoSummary.averageHighlightScore),
  });

  if (report.timeline.events.length > 0) {
    sheet.addRow({});
    sheet.addRow({ field: 'Timeline' }).font = { bold: true };
    for (const event of report.timeline.events) {
      const value = event.errorMessage
        ? `${event.toStatus} - ${event.errorMessage}`
        : event.toStatus;
      sheet.addRow({ field: event.occurredAt, value });
    }
  }
}

// One row per clip - the highlight entries list drives iteration (every
// clip always has one, unlike keyword/cta/face/speech/ocr entries which
// mirror it 1:1 anyway since report-builder assembles every section from
// the same clip list) - keyed lookups avoid assuming array order matches.
function addClipsSheet(workbook: ExcelJS.Workbook, report: VideoReportData): void {
  const sheet = workbook.addWorksheet('Clips');
  sheet.columns = [
    { header: 'Clip ID', key: 'clipId', width: 20 },
    { header: 'Highlight Score', key: 'highlightScore', width: 16 },
    { header: 'Highlight Rank', key: 'highlightRank', width: 16 },
    { header: 'Reason', key: 'reason', width: 40 },
    { header: 'CTA Text', key: 'ctaText', width: 30 },
    { header: 'CTA Strength', key: 'ctaStrength', width: 14 },
    { header: 'Keywords', key: 'keywords', width: 30 },
    { header: 'Hashtags', key: 'hashtags', width: 30 },
    { header: 'Topics', key: 'topics', width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  const ctaByClip = new Map(report.cta.entries.map((entry) => [entry.clipId, entry]));
  const keywordByClip = new Map(report.keyword.entries.map((entry) => [entry.clipId, entry]));

  for (const entry of report.highlight.entries) {
    const cta = ctaByClip.get(entry.clipId);
    const keyword = keywordByClip.get(entry.clipId);
    sheet.addRow({
      clipId: entry.clipId,
      highlightScore: fmt(entry.highlightScore),
      highlightRank: fmt(entry.highlightRank),
      reason: fmt(entry.highlightReason),
      ctaText: fmt(cta?.ctaText ?? null),
      ctaStrength: fmt(cta?.ctaStrength ?? null),
      keywords: keyword?.keywords.join(', ') || NA,
      hashtags: keyword?.hashtags.join(', ') || NA,
      topics: keyword?.topics.join(', ') || NA,
    });
  }
}

function addAiAnalysisSheet(workbook: ExcelJS.Workbook, report: VideoReportData): void {
  const sheet = workbook.addWorksheet('AI Analysis');
  sheet.columns = [
    { header: 'Clip ID', key: 'clipId', width: 20 },
    { header: 'Dominant Face Emotion', key: 'faceEmotion', width: 22 },
    { header: 'Dominant Vocal Emotion', key: 'vocalEmotion', width: 22 },
    { header: 'Subtitle Coverage', key: 'subtitleCoverage', width: 18 },
    { header: 'Top Factors', key: 'topFactors', width: 50 },
  ];
  sheet.getRow(1).font = { bold: true };

  const faceByClip = new Map(report.faceAnalysis.entries.map((entry) => [entry.clipId, entry]));
  const speechByClip = new Map(report.speechAnalysis.entries.map((entry) => [entry.clipId, entry]));
  const ocrByClip = new Map(report.ocrSummary.entries.map((entry) => [entry.clipId, entry]));

  for (const entry of report.highlight.entries) {
    const face = faceByClip.get(entry.clipId);
    const speech = speechByClip.get(entry.clipId);
    const ocr = ocrByClip.get(entry.clipId);
    sheet.addRow({
      clipId: entry.clipId,
      faceEmotion: fmt(face?.features?.dominantEmotion ?? null),
      vocalEmotion: fmt(speech?.vocalEmotion.dominantEmotion ?? null),
      subtitleCoverage: fmt(ocr?.features?.subtitleCoverageRate ?? null),
      topFactors:
        entry.topFactors.map((factor) => `${factor.signal}/${factor.feature}`).join(', ') || NA,
    });
  }
}

export function buildVideoReportWorkbook(report: VideoReportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Speedora Export Center';
  workbook.created = new Date();

  addOverviewSheet(workbook, report);
  addClipsSheet(workbook, report);
  addAiAnalysisSheet(workbook, report);

  return workbook;
}
