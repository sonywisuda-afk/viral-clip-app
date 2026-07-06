import { cutRangeSchema } from './cutlist';

describe('cutRangeSchema', () => {
  it('accepts a valid range', () => {
    expect(cutRangeSchema.safeParse({ start: 1.5, end: 3 }).success).toBe(true);
  });

  it('rejects a range missing a field', () => {
    expect(cutRangeSchema.safeParse({ start: 1.5 }).success).toBe(false);
  });
});
