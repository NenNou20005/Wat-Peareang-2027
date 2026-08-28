/**
 * Wat Peareang Archive - Search Query Normalizer Utility
 * Handles Khmer Unicode, zero-width characters, diacritics, whitespace, and digit normalization.
 */

// Khmer to Arabic digits mapping
const KHMER_TO_ARABIC_DIGITS: Record<string, string> = {
  "០": "0",
  "១": "1",
  "២": "2",
  "៣": "3",
  "៤": "4",
  "៥": "5",
  "៦": "6",
  "៧": "7",
  "៨": "8",
  "៩": "9",
};

// Arabic to Khmer digits mapping
const ARABIC_TO_KHMER_DIGITS: Record<string, string> = {
  "0": "០",
  "1": "១",
  "2": "២",
  "3": "៣",
  "4": "៤",
  "5": "៥",
  "6": "៦",
  "7": "៧",
  "8": "៨",
  "9": "៩",
};

/**
 * Convert Khmer digits (០-៩) in a string to Western/Arabic digits (0-9)
 */
export function khmerToWesternDigits(str: string): string {
  if (!str) return "";
  return str.replace(/[០-៩]/g, (char) => KHMER_TO_ARABIC_DIGITS[char] ?? char);
}

/**
 * Convert Western/Arabic digits (0-9) in a string to Khmer digits (០-៩)
 */
export function westernToKhmerDigits(str: string): string {
  if (!str) return "";
  return str.replace(/[0-9]/g, (char) => ARABIC_TO_KHMER_DIGITS[char] ?? char);
}

/**
 * Normalize search queries for indexing, deduplication, and aggregation.
 * - Strips zero-width characters (ZWSP, ZWNJ, ZWJ, etc.)
 * - Collapses consecutive spaces
 * - Lowercases Latin characters
 * - Normalizes Khmer digits to Western digits for unified search grouping
 * - Removes non-alphanumeric punctuation symbols while preserving Khmer characters
 */
export function normalizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return "";

  let q = rawQuery;

  // 1. Remove zero-width spaces, soft hyphens, byte order marks, non-breaking spaces
  // \u200B (ZWSP), \u200C (ZWNJ), \u200D (ZWJ), \u2060 (word joiner), \u00AD (soft hyphen), \uFEFF (BOM), \u00A0 (NBSP)
  // eslint-disable-next-line no-misleading-character-class
  q = q.replace(/[\u200B\u200C\u200D\u2060\u00AD\uFEFF\u00A0]/gu, " ");

  // 2. Normalize unicode composition (NFC)
  try {
    q = q.normalize("NFC");
  } catch {
    // ignore
  }

  // 3. Lowercase Latin characters
  q = q.toLowerCase();

  // 4. Convert Khmer digits to Arabic digits for normalized comparison
  q = khmerToWesternDigits(q);

  // 5. Remove symbols and noise characters, preserving Khmer script (\u1780-\u17FF, \u19E0-\u19FF),
  // Latin alphanumeric (a-z, 0-9), and single spaces
  q = q.replace(/[^a-z0-9\u1780-\u17FF\u19E0-\u19FF\s]/g, " ");

  // 6. Collapse multiple whitespaces into a single space and trim
  q = q.replace(/\s+/g, " ").trim();

  return q;
}

/**
 * Extract meaningful search keywords from a query string
 */
export function extractKeywords(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}
