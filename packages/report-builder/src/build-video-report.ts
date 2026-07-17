import {
  buildVideoReportInputSchema,
  videoReportDataSchema,
  type BuildVideoReportInput,
  type VideoReportData,
} from '@speedora/contracts';
import {
  buildCoverSection,
  buildThumbnailSection,
  buildTimelineSection,
  buildVideoSummarySection,
} from './sections/structural';
import { buildHighlightSection, buildTopMomentsSection } from './sections/highlights';
import {
  buildCtaSection,
  buildFaceAnalysisSection,
  buildKeywordSection,
  buildOcrSummarySection,
  buildSpeechAnalysisSection,
} from './sections/content-signals';

// The Export Center's video report: 11 sections, each grouping every clip's
// own contribution together (mirrors how a PDF actually reads - one section
// per topic, not one repeating block per clip). Pure and synchronous - every
// section builder below reads only what's already on the narrowed input, no
// external calls, no DB/queue access (see this package's own description).
export function buildVideoReportData(input: BuildVideoReportInput): VideoReportData {
  const { video, clips, statusEvents } = buildVideoReportInputSchema.parse(input);

  return videoReportDataSchema.parse({
    cover: buildCoverSection(video),
    videoSummary: buildVideoSummarySection(video, clips),
    timeline: buildTimelineSection(statusEvents),
    highlight: buildHighlightSection(clips),
    topMoments: buildTopMomentsSection(clips),
    faceAnalysis: buildFaceAnalysisSection(clips),
    speechAnalysis: buildSpeechAnalysisSection(clips),
    ocrSummary: buildOcrSummarySection(clips),
    keyword: buildKeywordSection(clips),
    cta: buildCtaSection(clips),
    thumbnail: buildThumbnailSection(clips),
  });
}
