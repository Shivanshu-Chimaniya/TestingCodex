const punctuationVariants = /[’']/g;
const punctuationNoise = /[\p{P}\p{S}]+/gu;

export function normalizeAnswer(input: string) {
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(punctuationVariants, "'")
    .replace(punctuationNoise, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAnswerSet(values: string[]) {
  return [...new Set(values.map((value) => normalizeAnswer(value)).filter((value) => value.length >= 2))];
}
