import type { EditingRhythmFeatures, EditingRhythmInput } from '@speedora/contracts';
import { calculateAcceleration } from './calculate-acceleration';
import { calculatePacing } from './calculate-pacing';
import { calculateTempo } from './calculate-tempo';

// Per explicit user architectural direction (given right after Scene
// Intelligence Batch SC-3): composite/derived features - this whole module
// - are treated exactly like raw-detection features. This is the
// "deriveXFeatures" entry point every other signal module in this pipeline
// exports (deriveSceneFeatures, deriveMotionEnergyFeatures,
// deriveCameraMotionFeatures, ...), kept name-consistent here even though
// this module's input is OTHER modules' output rather than a fresh raw
// detector's samples - it plays the same "profile" role the user described
// (orchestrating calculateTempo/calculatePacing/calculateAcceleration,
// each independently exported and unit-testable on its own) into one
// features object.
export function deriveEditingRhythmFeatures(input: EditingRhythmInput): EditingRhythmFeatures {
  return {
    tempoScore: calculateTempo(input),
    pacingScore: calculatePacing(input.sceneCuts, input.clipDurationSeconds),
    accelerationScore: calculateAcceleration(
      input.clipDurationSeconds,
      input.sceneCuts,
      input.motionEnergySamples,
    ),
  };
}
