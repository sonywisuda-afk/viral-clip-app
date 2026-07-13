// Moved verbatim from apps/worker/src/scripts/dataset-lib.ts in Milestone
// 5C-B - see flatten.ts's header comment for why.
export const MIN_SAMPLES_FOR_CORRELATION = 20;

// Pure Pearson correlation coefficient, pairwise-complete (skips indices
// where either value is missing). Returns null when there's not enough
// variance/data to compute a meaningful coefficient.
export function pearsonCorrelation(
  xs: Array<number | null>,
  ys: Array<number | null>,
): number | null {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x !== null && x !== undefined && y !== null && y !== undefined) pairs.push([x, y]);
  }
  if (pairs.length < 2) return null;

  const n = pairs.length;
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / n;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return null;
  return cov / Math.sqrt(varX * varY);
}
