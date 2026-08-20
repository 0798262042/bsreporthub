/**
 * Tolerant topic matching for attendance uploads.
 *
 * Zoom topics and filenames describe the same session in many shapes:
 *   "BS-19 August 2026- BUSINESS STRATEGY - DR MSUTHWANA.xls"
 *   "BS-MBA BUSINESS STRATEGY - DR MSUTHWANA"
 * Both refer to the same module + lecturer. This module normalises away dates,
 * programme prefixes, module codes, punctuation and casing, then compares the
 * remaining meaningful tokens — strict enough to reject unrelated files.
 */

const MONTHS =
  "jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?";

// Words that carry no identifying meaning for a module/lecturer comparison.
const NOISE = new Set([
  "bs",
  "and",
  "or",
  "the",
  "of",
  "for",
  "to",
  "with",
  "in",
  "session",
  "sessions",
  "lecture",
  "class",
  "year",
  "sem",
  "semester",
  "block",
  "group",
  "term",
  "mba",
  "pdba",
  "mmm",
  "dr",
  "prof",
  "professor",
  "mr",
  "mrs",
  "ms",
  "miss",
  "doctor",
]);

/** Remove dates, times, extensions, module codes and punctuation. */
export function canonicalText(input: string): string {
  let s = (input || "").toLowerCase();
  s = s.replace(/\.(xlsx?|csv)$/i, "");
  // times / time ranges
  s = s.replace(
    /\b\d{1,2}[:.]\d{2}\s*(?:am|pm)?\s*(?:-|–|—|to|until|till)?\s*(?:\d{1,2}[:.]\d{2}\s*(?:am|pm)?)?\b/gi,
    " ",
  );
  // written and numeric dates
  s = s.replace(new RegExp(`\\d{1,2}(st|nd|rd|th)?\\s*(${MONTHS})\\s*\\d{2,4}?`, "gi"), " ");
  s = s.replace(new RegExp(`(${MONTHS})\\s*\\d{1,2}(st|nd|rd|th)?[,\\s]*\\d{2,4}?`, "gi"), " ");
  s = s.replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, " ");
  s = s.replace(/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/g, " ");
  // module codes like BARF501, HRM4102
  s = s.replace(/\b[a-z]{2,5}\s?\d{3,5}\b/g, " ");
  // leftover bare numbers and punctuation
  s = s.replace(/\d+/g, " ");
  s = s.replace(/[^a-z\s]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Meaningful tokens of a topic (noise words and 1-char tokens dropped). */
export function meaningfulTokens(input: string): string[] {
  return canonicalText(input)
    .split(" ")
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

/** Jaro-Winkler similarity (0..1) — tolerant of typos in short names. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aFlags = new Array(a.length).fill(false);
  const bFlags = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue;
      aFlags[i] = true;
      bFlags[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aFlags[i]) continue;
    while (!bFlags[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** True when two lecturer names plausibly refer to the same person. */
export function lecturerLooksSame(a: string, b: string): boolean {
  const ta = meaningfulTokens(a);
  const tb = meaningfulTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const ca = ta.join(" ");
  const cb = tb.join(" ");
  if (ca === cb) return true;
  if (similarity(ca, cb) >= 0.92) return true;
  // Surname match (last token) is a strong signal, e.g. "DR MSUTHWANA" vs "MSUTHWANA T".
  const sa = ta[ta.length - 1];
  const sb = tb[tb.length - 1];
  if (sa.length > 3 && sb.length > 3 && similarity(sa, sb) >= 0.93) return true;
  // One name fully contained in the other ("Werner" vs "Prof Werner Amanda").
  return ta.every((t) => tb.includes(t)) || tb.every((t) => ta.includes(t));
}

/** Token overlap ratio (0..1) between two module descriptions. */
export function moduleOverlap(a: string, b: string): number {
  const ta = new Set(meaningfulTokens(a));
  const tb = new Set(meaningfulTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      shared++;
      continue;
    }
    // allow near-identical tokens (plural / typo)
    for (const u of tb) {
      if (similarity(t, u) >= 0.93) {
        shared++;
        break;
      }
    }
  }
  return shared / Math.min(ta.size, tb.size);
}

/** True when two module descriptions plausibly refer to the same module. */
export function moduleLooksSame(a: string, b: string): boolean {
  return moduleOverlap(a, b) >= 0.7;
}
