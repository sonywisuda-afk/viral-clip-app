import type { TrainingSample } from '@speedora/contracts';

export interface TrainValidationSplit {
  train: TrainingSample[];
  validation: TrainingSample[];
}

// A plain positional split (last `validationRatio` fraction becomes
// validation) - deliberately not shuffled or stratified. A real training
// pipeline would want a shuffle + a fixed random seed for reproducibility;
// that's real ML behavior this framework-only milestone doesn't need to
// decide yet (see docs/ai/fusion-v3.md's "Training pipeline" section).
export function splitTrainValidation(
  samples: TrainingSample[],
  validationRatio: number,
): TrainValidationSplit {
  if (validationRatio < 0 || validationRatio >= 1) {
    throw new Error(`validationRatio must be in [0, 1), got ${validationRatio}`);
  }
  const validationCount = Math.round(samples.length * validationRatio);
  const splitIndex = samples.length - validationCount;
  return {
    train: samples.slice(0, splitIndex),
    validation: samples.slice(splitIndex),
  };
}
