import {
  emojiSuggestionInputSchema,
  emojiSuggestionOutputSchema,
  type EmojiSuggestionInput,
  type EmojiSuggestionOutput,
} from '@speedora/contracts';

// At most this many suggestions per clip - a caption doesn't need a dozen
// emoji, and capping keeps the output usable as a short row of reaction
// icons rather than a wall of them.
const MAX_EMOJIS = 5;

// Deterministic keyword-pattern rules, NOT an LLM call or a trained
// sentiment model - same "kejujuran skala" (honest about being a simple
// heuristic) as @speedora/subtitles's BOLD_HIGHLIGHT keyword pattern and
// @speedora/reframe's emphasis-word zoom: cheap, instant, and predictable,
// at the cost of missing anything phrased in a way these patterns don't
// cover. Order matters - it's also the tie-break order when a text matches
// several rules (earlier rules win a spot first, subject to MAX_EMOJIS).
const RULES: Array<{ pattern: RegExp; emoji: string }> = [
  { pattern: /\b(money|cash|dollar|profit|rich)\b/i, emoji: '💰' },
  { pattern: /\b(fire|amazing|incredible|insane)\b/i, emoji: '🔥' },
  { pattern: /\b(love|heart)\b/i, emoji: '❤️' },
  { pattern: /\b(warning|danger|careful|caution)\b/i, emoji: '⚠️' },
  { pattern: /\d+\s*%|\bpercent\b/i, emoji: '📈' },
  { pattern: /\b(funny|hilarious|laugh(ing)?)\b/i, emoji: '😂' },
  { pattern: /\b(wow|omg|shocking|unbelievable)\b/i, emoji: '😱' },
  { pattern: /\b(tip|hack|secret)\b/i, emoji: '💡' },
  { pattern: /\?/, emoji: '🤔' },
];

// Suggests contextual emoji for a clip's caption from its transcript text -
// pure, synchronous, no external calls at all (same "small pure function"
// shape as @speedora/cutlist/@speedora/reframe's crop-path math, not
// clip-scoring's LLM-call shape - there's no external dependency to inject
// here, so no `deps` parameter).
export function suggestEmojis(input: EmojiSuggestionInput): EmojiSuggestionOutput {
  const { text } = emojiSuggestionInputSchema.parse(input);

  const emojis: string[] = [];
  for (const rule of RULES) {
    if (emojis.length >= MAX_EMOJIS) break;
    if (rule.pattern.test(text) && !emojis.includes(rule.emoji)) {
      emojis.push(rule.emoji);
    }
  }

  return emojiSuggestionOutputSchema.parse({ emojis });
}
