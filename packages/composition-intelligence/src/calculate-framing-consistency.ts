import type { CompositionSample } from '@speedora/contracts';

// Coarse shot-type bucket from subjectBox area relative to the frame
// (already normalized [0, 1], so width * height IS the fraction of frame
// area the subject's box covers - no frameSize needed to compute this).
// Reasonable, uncalibrated guesses, thresholded the same way @speedora/
// scene-intelligence already buckets continuous camera-transform values
// into dominantMotionType - see docs/ai/composition-intelligence.md's
// RB-1 section.
type ShotType = 'close_up' | 'medium' | 'wide';

const CLOSE_UP_AREA_THRESHOLD = 0.25;
const MEDIUM_AREA_THRESHOLD = 0.08;

function classifyShotType(box: NonNullable<CompositionSample['subjectBox']>): ShotType {
  const area = box.width * box.height;
  if (area >= CLOSE_UP_AREA_THRESHOLD) return 'close_up';
  if (area >= MEDIUM_AREA_THRESHOLD) return 'medium';
  return 'wide';
}

// Batch RB-1 - rate of shot-type transitions (close-up <-> medium <-> wide)
// per minute of clip duration. A SHOT-TYPE CHANGE IS NOT AUTOMATICALLY
// BAD - wide -> medium -> close-up is often deliberate editing. This
// function measures OSCILLATION FREQUENCY / apparently-unnecessary
// reframing (how often the bucket flips per minute), never shot-type
// DIVERSITY itself - it must never be read as "fewer shot types =
// better", only as "how much back-and-forth reframing happened", so
// deliberate multi-shot-type editing isn't penalized just for using more
// than one shot type (see docs/ai/composition-intelligence.md). Clip
// duration is read from the full sample set's own time span (last t -
// first t), not a separate input field - avoids requiring a
// clipDurationSeconds field this module doesn't otherwise need. Null when
// fewer than 2 samples have a subjectBox, or the derived duration is zero
// (nothing to compute a per-minute rate against).
export function calculateFramingConsistency(samples: CompositionSample[]): number | null {
  const present = samples.filter(
    (
      sample,
    ): sample is CompositionSample & { subjectBox: NonNullable<CompositionSample['subjectBox']> } =>
      sample.subjectBox !== null,
  );
  if (present.length < 2) return null;

  const times = samples.map((sample) => sample.t);
  const durationMinutes = (Math.max(...times) - Math.min(...times)) / 60;
  if (durationMinutes <= 0) return null;

  let transitions = 0;
  for (let i = 1; i < present.length; i++) {
    if (classifyShotType(present[i].subjectBox) !== classifyShotType(present[i - 1].subjectBox)) {
      transitions++;
    }
  }

  return transitions / durationMinutes;
}
