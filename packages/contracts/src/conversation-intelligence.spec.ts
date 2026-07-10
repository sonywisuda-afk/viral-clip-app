import { conversationTypeResultSchema } from './conversation-intelligence';

describe('conversationTypeResultSchema', () => {
  it('accepts a classified conversation type', () => {
    const result = conversationTypeResultSchema.safeParse({ type: 'interview', confidence: 0.7 });
    expect(result.success).toBe(true);
  });

  it('accepts a null type when there is not enough diarization data', () => {
    const result = conversationTypeResultSchema.safeParse({ type: null, confidence: null });
    expect(result.success).toBe(true);
  });

  it('rejects an unrecognized conversation type', () => {
    const result = conversationTypeResultSchema.safeParse({ type: 'roundtable', confidence: 0.5 });
    expect(result.success).toBe(false);
  });
});
