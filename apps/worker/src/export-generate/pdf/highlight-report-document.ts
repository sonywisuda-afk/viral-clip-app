import * as React from 'react';
import { Document } from '@react-pdf/renderer';
import type { VideoReportData } from '@speedora/contracts';
import { createSectionBuilders, createStyles, Page } from './sections';

// Sprint 03d - a focused subset of the video report (cover + highlight +
// topMoments only), reusing the exact same VideoReportData PDF already
// gets - no new data fetching, just a leaner document for someone who only
// wants "which clips scored well and why," not the full 11-section report.
export function buildHighlightReportDocument(report: VideoReportData): React.ReactElement {
  const styles = createStyles();
  const { divider, buildCoverBlock, buildHighlightBlock, buildTopMomentsBlock } =
    createSectionBuilders(styles);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      buildCoverBlock(report.cover, 'Speedora Export Center - Highlight Report'),
      divider(),
      buildHighlightBlock(report.highlight),
      divider(),
      buildTopMomentsBlock(report.topMoments),
    ),
  );
}
