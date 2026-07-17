import * as React from 'react';
import { Document, Text } from '@react-pdf/renderer';
import type { VideoReportData } from '@speedora/contracts';
import { createSectionBuilders, createStyles, Page } from './sections';

export interface BrandKitForDocument {
  logoUrl: string | null;
  primaryColor: string | null;
}

// Sprint 03d - the same full 11-section content as the plain video report,
// styled with the user's own Brand Kit colors instead of the default
// black/grey palette. Falls back to the default palette when no
// primaryColor is set (graceful degradation, not a blocked export - see
// schema.prisma's own comment on User.brandPrimaryColor). Logo is
// referenced as text only, not embedded as an image - same posture as the
// existing Thumbnail section, for the same reason (no authenticated-image-
// fetch path exists in apps/worker yet).
export function buildBrandReportDocument(
  report: VideoReportData,
  brandKit: BrandKitForDocument,
): React.ReactElement {
  const styles = createStyles(brandKit.primaryColor ?? undefined);
  const {
    divider,
    buildCoverBlock,
    buildVideoSummaryBlock,
    buildTimelineBlock,
    buildHighlightBlock,
    buildTopMomentsBlock,
    buildFaceAnalysisBlock,
    buildSpeechAnalysisBlock,
    buildOcrSummaryBlock,
    buildKeywordBlock,
    buildCtaBlock,
    buildThumbnailBlock,
  } = createSectionBuilders(styles);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      buildCoverBlock(report.cover, 'Speedora Export Center - Brand Report'),
      brandKit.logoUrl
        ? React.createElement(Text, { style: styles.muted }, `Brand logo: ${brandKit.logoUrl}`)
        : null,
      buildVideoSummaryBlock(report.videoSummary),
      divider(),
      buildTimelineBlock(report.timeline),
      divider(),
      buildHighlightBlock(report.highlight),
      divider(),
      buildTopMomentsBlock(report.topMoments),
      divider(),
      buildFaceAnalysisBlock(report.faceAnalysis),
      buildSpeechAnalysisBlock(report.speechAnalysis),
      buildOcrSummaryBlock(report.ocrSummary),
      divider(),
      buildKeywordBlock(report.keyword),
      buildCtaBlock(report.cta),
      divider(),
      buildThumbnailBlock(report.thumbnail),
    ),
  );
}
