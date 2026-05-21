const SENTENCE_END_PATTERN = /[.!?]/;
const LETTER_PATTERN = /\p{L}/u;
const LEADING_PUNCTUATION_PATTERN = /["'([{]/;

export function formatFeedbackText(value: string): string {
  let shouldCapitalize = true;
  let formatted = "";

  for (const character of value.trim()) {
    if (shouldCapitalize && LETTER_PATTERN.test(character)) {
      formatted += character.toLocaleUpperCase();
      shouldCapitalize = false;
      continue;
    }

    formatted += character;

    if (SENTENCE_END_PATTERN.test(character)) {
      shouldCapitalize = true;
      continue;
    }

    if (!/\s/.test(character) && !LEADING_PUNCTUATION_PATTERN.test(character)) {
      shouldCapitalize = false;
    }
  }

  return formatted;
}
