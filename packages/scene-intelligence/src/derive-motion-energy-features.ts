import type { MotionEnergyFeatures, MotionEnergySample } from '@speedora/contracts';

// A sample's motionEnergy at/below this reads as "static" for the Static/
// Dynamic Scene classification in the user's taxonomy - a reasonable guess
// (YDIF is a 0-255 luma scale; a locked-off talking-head shot with only
// lighting flicker/compression noise typically stays in the low single
// digits), NOT calibrated against real footage - same "kejujuran skala" as
// every other threshold in this pipeline (FADE_PROXIMITY_SECONDS,
// SILENCE_RMS_DB_THRESHOLD, etc.).
const STATIC_DYNAMIC_THRESHOLD = 4;

// Pure, synchronous summary derivation over analyzeMotionEnergy()'s raw
// `samples` array - a separate function from the subprocess-calling one,
// same reason as every other deriveXFeatures in this pipeline (see
// packages/contracts/src/intelligence-signal.ts).
export function deriveMotionEnergyFeatures(samples: MotionEnergySample[]): MotionEnergyFeatures {
  if (samples.length === 0) {
    return {
      averageMotionEnergy: null,
      peakMotionEnergy: null,
      staticRatio: null,
      dynamicRatio: null,
    };
  }

  const values = samples.map((sample) => sample.motionEnergy);
  const averageMotionEnergy = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peakMotionEnergy = Math.max(...values);
  const staticCount = values.filter((value) => value <= STATIC_DYNAMIC_THRESHOLD).length;
  const staticRatio = staticCount / values.length;
  const dynamicRatio = 1 - staticRatio;

  return { averageMotionEnergy, peakMotionEnergy, staticRatio, dynamicRatio };
}
