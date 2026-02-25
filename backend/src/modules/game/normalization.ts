const punctuationVariants = /[’']/g;

export function normalizeAnswer(input: string) {
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(punctuationVariants, "'")
    .replace(/\s+/g, ' ');
}
