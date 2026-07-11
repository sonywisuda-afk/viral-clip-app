import { calculateLeadRoomScore } from './calculate-lead-room';

function sample(
  t: number,
  xCenter: number | null,
  opts: { width?: number; facingYaw?: number | null } = {},
) {
  const { width = 0.2, facingYaw = null } = opts;
  return {
    t,
    subjectBox: xCenter === null ? null : { xCenter, yCenter: 0.5, width, height: 0.4 },
    subjectTrackId: null,
    facingYaw,
  };
}

describe('calculateLeadRoomScore', () => {
  it('returns null when no sample ever had a subjectBox', () => {
    expect(calculateLeadRoomScore([sample(0, null)])).toBeNull();
  });

  it('scores 1 when facing right with in-range lead room', () => {
    // rightEdge = 0.7 + 0.1 = 0.8 -> leadRoomValue = 0.2, inside [0.1, 0.3].
    expect(calculateLeadRoomScore([sample(0, 0.7, { facingYaw: 30 })])).toBe(1);
  });

  it('scores 1 when facing left with in-range lead room', () => {
    // leftEdge = 0.3 - 0.1 = 0.2, inside [0.1, 0.3].
    expect(calculateLeadRoomScore([sample(0, 0.3, { facingYaw: -30 })])).toBe(1);
  });

  it('excludes frames facing roughly straight at the camera (neutral yaw)', () => {
    expect(calculateLeadRoomScore([sample(0, 0.5, { facingYaw: 5 })])).toBeNull();
  });

  it('falls back to the recent motion trend when facingYaw is unavailable', () => {
    const result = calculateLeadRoomScore([
      sample(0, 0.3, { facingYaw: null }),
      sample(1, 0.7, { facingYaw: null }), // moved right -> treated as heading right
    ]);
    // Second sample: rightEdge = 0.8 -> leadRoomValue = 0.2, inside range.
    expect(result).toBe(1);
  });

  it('returns null when the motion-trend fallback has no clear direction either', () => {
    const result = calculateLeadRoomScore([
      sample(0, 0.5, { facingYaw: null }),
      sample(1, 0.505, { facingYaw: null }), // negligible movement
    ]);
    expect(result).toBeNull();
  });
});
