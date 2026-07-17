import * as React from 'react';
import { Document } from '@react-pdf/renderer';
import type { VideoReportData } from '@speedora/contracts';
import { createSectionBuilders, createStyles, Page } from './sections';

export function buildVideoReportDocument(report: VideoReportData): React.ReactElement {
  const styles = createStyles();
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
      buildCoverBlock(report.cover),
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
