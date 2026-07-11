import type {
  ActiveSpeakerSample,
  FaceLandmarkSample,
  ObjectTrack,
  PrimarySubjectSample,
} from '@speedora/contracts';

export interface SelectPrimarySubjectInput {
  // The canonical per-clip sample grid this selection runs over - supplied
  // by the caller (typically Face Landmarks' or Object Detection's own `t`
  // values, whichever is available), not inferred here. Keeps this
  // function a pure decision over already-given instants rather than
  // needing to know any module's own sampling-interval convention.
  sampleTimestamps: number[];
  faceLandmarks: FaceLandmarkSample[] | null;
  activeSpeakerSamples: ActiveSpeakerSample[] | null;
  objectTracks: ObjectTrack[] | null;
}

type Box = NonNullable<PrimarySubjectSample['box']>;

function area(box: Box): number {
  return box.width * box.height;
}

function pickLargest(tracks: ObjectTrack[]): ObjectTrack | null {
  let best: ObjectTrack | null = null;
  for (const track of tracks) {
    if (!best || area(track.boundingBox) > area(best.boundingBox)) best = track;
  }
  return best;
}

function pickHighestAttention(tracks: ObjectTrack[]): ObjectTrack | null {
  let best: ObjectTrack | null = null;
  for (const track of tracks) {
    if (!best || track.attentionScore > best.attentionScore) best = track;
  }
  return best;
}

// Primary Subject Selection - the documented 5-step order (see this
// package's own module comment and docs/ai/composition-intelligence.md).
// Never detects or tracks anything itself - only CHOOSES among candidates
// Facial/Active-Speaker/Object Intelligence already produced, per this
// package's own "reuse, never recompute" design principle.
//
// Object-sourced steps (3-5) use ObjectTrack's own AVERAGE boundingBox for
// the track's ENTIRE active window [startTime, endTime], not a true
// per-instant position - ObjectTrack's contract doesn't expose a
// per-appearance box/timestamp list (only clip-level summary stats), and
// re-deriving one here would mean re-implementing @speedora/object-
// intelligence's own tracker logic outside that package, exactly what this
// module's design principles rule out. A track's box is coarser than a
// face's (which IS genuinely per-instant, from faceLandmarks), but still a
// real, honestly-scoped answer, not a fabricated one.
export function selectPrimarySubject(input: SelectPrimarySubjectInput): PrimarySubjectSample[] {
  const { sampleTimestamps, faceLandmarks, activeSpeakerSamples, objectTracks } = input;

  const faceByTime = new Map<number, FaceLandmarkSample>();
  for (const sample of faceLandmarks ?? []) {
    faceByTime.set(sample.t, sample);
  }
  const activeSpeakerByTime = new Map<number, ActiveSpeakerSample>();
  for (const sample of activeSpeakerSamples ?? []) {
    activeSpeakerByTime.set(sample.t, sample);
  }
  const tracks = objectTracks ?? [];

  return sampleTimestamps.map((t): PrimarySubjectSample => {
    const face = faceByTime.get(t) ?? null;
    const activeSpeaker = activeSpeakerByTime.get(t) ?? null;

    // Step 1: active speaker. Face Detection in this pipeline tracks only
    // the single most-prominent face at a time (see docs/ai/object-
    // intelligence.md's "Explicitly out of scope" - multi-face tracking
    // isn't built), so activeTrackId matching THE currently-tracked face's
    // own trackId mostly confirms "yes, this one face is confidently
    // talking" rather than choosing among several candidates - still the
    // documented first rule, and the distinction becomes meaningful once
    // multi-face tracking exists.
    if (
      activeSpeaker?.activeTrackId !== null &&
      activeSpeaker?.activeTrackId !== undefined &&
      face?.boundingBox &&
      face.trackId === activeSpeaker.activeTrackId
    ) {
      return {
        t,
        box: face.boundingBox,
        trackId: face.trackId,
        facingYaw: face.rotation?.yaw ?? null,
        source: 'active_speaker',
      };
    }

    // Step 2: largest visible face. Only ever one face per sample in this
    // pipeline (same single-most-prominent-face limitation as above), so
    // "largest" is trivially "the" face - no comparison needed.
    if (face?.boundingBox) {
      return {
        t,
        box: face.boundingBox,
        trackId: face.trackId,
        facingYaw: face.rotation?.yaw ?? null,
        source: 'face',
      };
    }

    const activeTracks = tracks.filter((track) => track.startTime <= t && t <= track.endTime);

    // Step 3: largest tracked person.
    const largestPerson = pickLargest(activeTracks.filter((track) => track.category === 'person'));
    if (largestPerson) {
      return {
        t,
        box: largestPerson.boundingBox,
        trackId: largestPerson.trackId,
        facingYaw: null,
        source: 'tracked_person',
      };
    }

    // Step 4: highest objectAttentionScore (any category - if a person
    // track existed it would already have been returned by Step 3).
    const highestAttention = pickHighestAttention(activeTracks);
    if (highestAttention) {
      return {
        t,
        box: highestAttention.boundingBox,
        trackId: highestAttention.trackId,
        facingYaw: null,
        source: 'attention_object',
      };
    }

    // Step 5: largest tracked object (any category). Reachable only when
    // Step 4 already found nothing, which means activeTracks is empty -
    // this branch exists for documentation/priority-order completeness,
    // not because it can differ from Step 4's outcome today.
    const largestObject = pickLargest(activeTracks);
    if (largestObject) {
      return {
        t,
        box: largestObject.boundingBox,
        trackId: largestObject.trackId,
        facingYaw: null,
        source: 'tracked_object',
      };
    }

    // No candidate at all - a real "no subject this instant", not an error.
    return { t, box: null, trackId: null, facingYaw: null, source: null };
  });
}
