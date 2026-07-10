import type { SceneCutEvent, SceneFeatures } from '@speedora/contracts';

// Pure, synchronous summary derivation over detectSceneCuts()'s raw `cuts`
// array - a separate function from the subprocess-calling one, same reason
// as @speedora/facial-intelligence's deriveFacialEmotionFeatures(). See
// packages/contracts/src/intelligence-signal.ts.
//
// `cutEvents` (Batch SC-1) is optional and defaults to [] - callers that
// haven't run classifySceneCutTypes (or whose classification pass failed)
// simply don't pass it, and every cut is conservatively counted as a hard
// cut, the same "degrade to the least-surprising default" classifySceneCutTypes'
// own catch block already uses. When passed, it's expected to classify
// every entry in `cuts` (classifySceneCutTypes' own contract) - hardCutCount
// is derived as cutCount minus the fade/dissolve counts rather than counted
// directly, so it's correct either way without the two arrays needing to be
// walked in lockstep.
export function deriveSceneFeatures(
  cuts: number[],
  clipDurationSeconds: number,
  cutEvents: SceneCutEvent[] = [],
): SceneFeatures {
  const cutCount = cuts.length;
  const fadeCount = cutEvents.filter((event) => event.type === 'fade').length;
  const dissolveCount = cutEvents.filter((event) => event.type === 'dissolve').length;
  const hardCutCount = cutCount - fadeCount - dissolveCount;

  if (clipDurationSeconds <= 0) {
    return {
      cutCount,
      cutsPerMinute: null,
      averageSegmentSeconds: null,
      hardCutCount,
      fadeCount,
      dissolveCount,
    };
  }

  const cutsPerMinute = (cutCount / clipDurationSeconds) * 60;
  // The cuts (wherever they fall) divide the clip into cutCount + 1
  // segments whose lengths always sum to the full clip duration - no need
  // to sort/walk the individual cut positions to get the mean.
  const averageSegmentSeconds = clipDurationSeconds / (cutCount + 1);

  return { cutCount, cutsPerMinute, averageSegmentSeconds, hardCutCount, fadeCount, dissolveCount };
}
