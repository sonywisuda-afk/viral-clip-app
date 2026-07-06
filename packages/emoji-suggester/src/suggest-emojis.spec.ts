import { suggestEmojis } from './suggest-emojis';

describe('suggestEmojis', () => {
  it('returns no suggestions for plain text matching no rule', () => {
    expect(suggestEmojis({ text: 'just talking about my day' })).toEqual({ emojis: [] });
  });

  it('matches a money-related keyword', () => {
    expect(suggestEmojis({ text: 'this is how I made money last year' })).toEqual({
      emojis: ['💰'],
    });
  });

  it('matches an intensity keyword', () => {
    expect(suggestEmojis({ text: 'this result is absolutely insane' })).toEqual({
      emojis: ['🔥'],
    });
  });

  it('matches a percentage figure', () => {
    expect(suggestEmojis({ text: 'grew revenue by 40% this quarter' })).toEqual({
      emojis: ['📈'],
    });
  });

  it('matches a question mark', () => {
    expect(suggestEmojis({ text: 'have you ever wondered why this works' })).toEqual({
      emojis: [],
    });
    expect(suggestEmojis({ text: 'have you ever wondered why this works?' })).toEqual({
      emojis: ['🤔'],
    });
  });

  it('is case-insensitive', () => {
    expect(suggestEmojis({ text: 'AMAZING results this week' })).toEqual({ emojis: ['🔥'] });
  });

  it('does not match a keyword embedded inside another word', () => {
    // "loved" contains "love" as a substring but word-boundary matching
    // should still catch it (a real word, not a false substring match on
    // something unrelated like "glover").
    expect(suggestEmojis({ text: 'glover is a surname, not a feeling' })).toEqual({ emojis: [] });
  });

  it('collects multiple distinct matches in rule order, deduped', () => {
    const result = suggestEmojis({
      text: 'this money hack is amazing and kind of shocking, right?',
    });
    expect(result.emojis).toEqual(['💰', '🔥', '😱', '💡', '🤔']);
  });

  it('caps suggestions at 5 even when more rules match', () => {
    const result = suggestEmojis({
      text: 'money fire love warning 50% funny wow tip is this real?',
    });
    expect(result.emojis).toHaveLength(5);
    expect(result.emojis).toEqual(['💰', '🔥', '❤️', '⚠️', '📈']);
  });

  it('rejects a malformed input against the emojiSuggestionInputSchema contract', () => {
    expect(() => suggestEmojis({} as never)).toThrow();
  });
});
