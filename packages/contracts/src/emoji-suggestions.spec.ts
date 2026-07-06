import { emojiSuggestionInputSchema, emojiSuggestionOutputSchema } from './emoji-suggestions';

describe('emojiSuggestionInputSchema', () => {
  it('accepts a plain text string', () => {
    expect(emojiSuggestionInputSchema.safeParse({ text: 'hello world' }).success).toBe(true);
  });

  it('rejects a missing text field', () => {
    expect(emojiSuggestionInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('emojiSuggestionOutputSchema', () => {
  it('accepts an empty emoji list', () => {
    expect(emojiSuggestionOutputSchema.safeParse({ emojis: [] }).success).toBe(true);
  });

  it('accepts a list of emoji strings', () => {
    expect(emojiSuggestionOutputSchema.safeParse({ emojis: ['🔥', '💰'] }).success).toBe(true);
  });
});
