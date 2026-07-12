import type {
  FusionBreakdown,
  FusionExplainability,
  FusionPrediction,
  FusionRecommendation,
} from './video';

// Milestone 4 (AI Explainability) - `results` is an array of per-engine
// results, not a flat object, specifically so a future milestone that wires
// a real Fusion Engine v3 Predictor into the render pipeline can push a
// second entry (`engine: 'v3'`) without changing this contract. Today it
// always has exactly one entry (`engine: 'v2'`) - there is no real v3
// output to include yet.
export type FusionEngineVersion = 'v2' | 'v3';

export interface ClipEngineExplainability {
  engine: FusionEngineVersion;
  highlightScore: number | null;
  highlightConfidence: number | null;
  highlightReason: string | null;
  highlightBreakdown: FusionBreakdown;
  highlightExplainability: FusionExplainability;
  highlightPrediction: FusionPrediction | null;
  highlightRecommendation: FusionRecommendation | null;
  highlightRank: number | null;
}

export interface ClipExplainabilityDto {
  clipId: string;
  results: ClipEngineExplainability[];
}
