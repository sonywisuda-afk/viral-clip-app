import type { PrismaService } from '../prisma/prisma.service';
import { OpsAiService } from './ops-ai.service';

describe('OpsAiService', () => {
  let service: OpsAiService;
  let prisma: {
    clip: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = { clip: { findMany: jest.fn() } };
    service = new OpsAiService(prisma as unknown as PrismaService);
  });

  describe('getHealth', () => {
    it('does not filter by ownerId - system-wide, not owner-scoped', async () => {
      prisma.clip.findMany.mockResolvedValue([]);

      await service.getHealth();

      const args = prisma.clip.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ highlightScore: { not: null } });
    });

    it('wraps the health summary as { results: [{ engine: "v2", ... }] }', async () => {
      prisma.clip.findMany.mockResolvedValue([
        {
          highlightScore: 80,
          highlightConfidence: 0.9,
          highlightExplainability: {
            topFactors: [
              { signal: 'audio', feature: 'f', weightedContribution: 1, description: 'Loud' },
            ],
          },
        },
        {
          highlightScore: 40,
          highlightConfidence: 0.3,
          highlightExplainability: { topFactors: [] },
        },
      ]);

      const result = await service.getHealth();

      expect(result.results).toHaveLength(1);
      expect(result.results[0].engine).toBe('v2');
      expect(result.results[0].totalClipsWithScore).toBe(2);
      expect(result.results[0].missingExplainability).toBe(1);
    });
  });

  describe('getSignals', () => {
    it('computes signal contributions and explainability reasons from highlightBreakdown/Explainability', async () => {
      prisma.clip.findMany.mockResolvedValue([
        {
          highlightBreakdown: [
            {
              signal: 'audio',
              feature: 'f',
              rawValue: null,
              normalizedValue: 0.5,
              weight: 1,
              weightedContribution: 10,
            },
          ],
          highlightExplainability: {
            topFactors: [
              {
                signal: 'audio',
                feature: 'f',
                weightedContribution: 10,
                description: 'Loud audio',
              },
            ],
          },
        },
      ]);

      const result = await service.getSignals();

      expect(result.results[0].signalContributions).toEqual([
        { signal: 'audio', averageContributionPct: 100, clipsWithSignal: 1 },
      ]);
      expect(result.results[0].explainabilityReasons).toEqual([
        { description: 'Loud audio', count: 1, pct: 100 },
      ]);
    });
  });

  describe('getDistribution', () => {
    it('scopes the feature dataset query to highlightBreakdown not null, no ownerId', async () => {
      prisma.clip.findMany.mockResolvedValue([]);

      await service.getDistribution();

      const args = prisma.clip.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ highlightBreakdown: { not: null } });
    });
  });

  describe('getCorrelation', () => {
    it('reports insufficient data honestly when below MIN_SAMPLES_FOR_CORRELATION', async () => {
      prisma.clip.findMany.mockResolvedValue([]);

      const result = await service.getCorrelation();

      expect(result.results[0].hasEnoughSamples).toBe(false);
      expect(result.results[0].correlations).toEqual([]);
    });
  });

  describe('getReadiness', () => {
    it('is not ready with 0 samples', async () => {
      prisma.clip.findMany.mockResolvedValue([]);

      const result = await service.getReadiness();

      expect(result.results[0].ready).toBe(false);
      expect(result.results[0].usableSamples).toBe(0);
    });
  });
});
