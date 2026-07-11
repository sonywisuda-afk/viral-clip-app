import type { CompositionFeatures, CompositionInput } from '@speedora/contracts';
import { calculateCenteringScore } from './calculate-centering';
import { calculateCompositionStability } from './calculate-composition-stability';
import { calculateFramingConsistency } from './calculate-framing-consistency';
import { calculateHeadroomScore } from './calculate-headroom';
import { calculateLeadRoomScore } from './calculate-lead-room';
import { calculateRuleOfThirdsScore } from './calculate-rule-of-thirds';
import { calculateSubjectLossRatio } from './calculate-subject-loss-ratio';

// The "deriveXFeatures" entry point every other signal module in this
// pipeline exports (deriveSceneFeatures, deriveCameraMotionFeatures,
// deriveEditingRhythmFeatures, deriveObjectFeatures, ...), kept
// name-consistent here even though - same as @speedora/editing-rhythm -
// this module's input is OTHER modules' already-selected/already-tracked
// subject boxes rather than a fresh raw detector's samples. Orchestrates
// each independently exported/testable calculateX function (Batch RB-1)
// into one CompositionFeatures object; RB-2 (Fusion Engine wiring) and the
// worker adapter that resolves input.samples via Primary Subject Selection
// (see docs/ai/composition-intelligence.md) are not part of this package.
export function deriveCompositionFeatures(input: CompositionInput): CompositionFeatures {
  return {
    ruleOfThirdsScore: calculateRuleOfThirdsScore(input.samples),
    headroomScore: calculateHeadroomScore(input.samples, input.frameSize),
    leadRoomScore: calculateLeadRoomScore(input.samples),
    centeringScore: calculateCenteringScore(input.samples),
    subjectLossRatio: calculateSubjectLossRatio(input.samples),
    compositionStability: calculateCompositionStability(input.samples),
    framingConsistency: calculateFramingConsistency(input.samples),
  };
}
