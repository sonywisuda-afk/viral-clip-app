import { z } from 'zod';
import { motionEnergySampleSchema } from './scene-intelligence';

// Editing Rhythm (taxonomy category F, requested by the user on top of the
// original 12-item Scene Intelligence list, after Batch SC-1/SC-2/SC-3) -
// a COMPOSITE signal, NOT a raw detector: its input is OTHER modules'
// already-computed raw timelines (Scene Intelligence's sceneCuts/motion-
// energy samples) and already-computed aggregate features (cutsPerMinute,
// averageMotionEnergy, average speaking rate), not a fresh subprocess/
// ffmpeg call of its own.
//
// Per explicit user architectural rule (given right after Batch SC-3):
// (1) every new signal/domain gets its OWN package, even a pure function
// with no subprocess/ML; (2) the Fusion Engine never derives new features,
// it only combines/weighs whatever `*Features` objects already exist;
// (3) composite/derived features like this one are treated exactly like
// raw-detection features - independently testable/calibratable, following
// the same checklist in ARCHITECTURE.md as every other module.
export const editingRhythmInputSchema = z.object({
  clipDurationSeconds: z.number().nonnegative(),
  // Reused from Scene Intelligence's detectSceneCuts/Clip.sceneCuts, not
  // re-detected here.
  sceneCuts: z.array(z.number()),
  // Reused from Scene Intelligence's analyzeMotionEnergy/Clip.motionEnergy.
  motionEnergySamples: z.array(motionEnergySampleSchema),
  // Already-computed aggregate features from other signals - this module
  // combines them into a composite tempo reading, it doesn't re-derive
  // them from raw data itself.
  cutsPerMinute: z.number().nonnegative().nullable(),
  averageMotionEnergy: z.number().nonnegative().nullable(),
  averageSpeakingRateWordsPerSecond: z.number().nonnegative().nullable(),
});
export type EditingRhythmInput = z.infer<typeof editingRhythmInputSchema>;

export const editingRhythmFeaturesSchema = z.object({
  // Overall speed/energy reading - a composite of whichever of
  // cutsPerMinute/averageMotionEnergy/averageSpeakingRateWordsPerSecond are
  // available (see @speedora/editing-rhythm's calculateTempo()). Null only
  // when NONE of the three inputs are available, not a fabricated 0.
  tempoScore: z.number().min(0).max(1).nullable(),
  // Regularity of cut spacing across the clip (see calculatePacing()) - 1
  // means cuts are evenly spaced, approaching 0 as spacing becomes more
  // irregular. Null when there are fewer than two cuts (an interval needs
  // two points) or the clip has zero duration.
  pacingScore: z.number().min(0).max(1).nullable(),
  // -1 (cuts/motion concentrated in the first half of the clip) to 1
  // (concentrated in the second half, i.e. a "building"/accelerating edit)
  // - see calculateAcceleration(). Null when there isn't enough data on
  // either side of the midpoint to compare.
  accelerationScore: z.number().min(-1).max(1).nullable(),
});
export type EditingRhythmFeatures = z.infer<typeof editingRhythmFeaturesSchema>;
