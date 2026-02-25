const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const MULTI_SPACE_REGEX = /\s+/g;

export function canonicalizeString(value: string) {
  return value.replace(CONTROL_CHARS_REGEX, '').trim().replace(MULTI_SPACE_REGEX, ' ');
}

export function canonicalizeLower(value: string) {
  return canonicalizeString(value).toLowerCase();
}
