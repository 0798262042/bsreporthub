// Name normalization + time formatting helpers

// Device / platform tokens that students often append to their display name.
// Examples: "Nomakhosi's iPhone", "Sipho Samsung", "John — Laptop".
const DEVICE_TOKENS = [
  "iphone",
  "ipad",
  "ipod",
  "samsung",
  "android",
  "huawei",
  "xiaomi",
  "redmi",
  "oppo",
  "vivo",
  "nokia",
  "laptop",
  "desktop",
  "macbook",
  "mac",
  "pc",
  "phone",
  "tablet",
  "device",
  "s10",
  "s20",
  "s21",
  "s22",
  "s23",
  "s24",
  "galaxy",
  "pixel",
  "windows",
  "chromebook",
];

function stripDeviceTokens(s: string): string {
  // Remove possessive device suffixes: "Nomakhosi's iPhone" -> "Nomakhosi"
  let out = s.replace(
    /['\u2019]s?\s+(?:iphone|ipad|ipod|samsung|android|huawei|xiaomi|redmi|oppo|vivo|nokia|laptop|desktop|macbook|mac|pc|phone|tablet|device|galaxy|pixel|chromebook)\b.*$/i,
    "",
  );
  // Remove trailing " - Device" or " — Device" or " Device"
  const parts = out.split(/[\s\-\u2013\u2014_/]+/).filter(Boolean);
  while (parts.length > 1) {
    const last = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (DEVICE_TOKENS.includes(last)) parts.pop();
    else break;
  }
  return parts.join(" ").trim() || out.trim();
}

export function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = raw.trim().replace(/\s+/g, " ");
  // strip trailing parenthetical alias: "Nomkhosi Mhlahlo (Nunu Mhlahlo)"
  s = s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  // strip trailing numeric IDs: "Chumasande Sive Myendeki 212293818"
  s = s.replace(/\s+\d{5,}$/g, "").trim();
  // strip device/platform suffixes: "Nomakhosi's iPhone" -> "Nomakhosi"
  s = stripDeviceTokens(s);
  // handle "Surname, First" -> "First Surname"
  if (s.includes(",")) {
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2 && !/\d/.test(parts[0])) {
      s = `${parts[1]} ${parts[0]}`;
    }
  }
  // Title case each word, preserve apostrophes and hyphens
  s = s
    .toLowerCase()
    .split(" ")
    .map((w) =>
      w
        .split("-")
        .map((seg) =>
          seg
            .split("'")
            .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
            .join("'"),
        )
        .join("-"),
    )
    .join(" ");
  return s;
}

export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase().replace(/[^a-z]/g, "");
}

// ---------- Date stripping for report / category titles ----------
// Removes date patterns like "23 May 2026", "23 May", "May 2026", "23/05/2026",
// "2026-05-23", "23-May-2026" from a title while preserving the surrounding
// text (e.g. "BS-23 May 2026-MBA LEADERSHIP" -> "BS-MBA LEADERSHIP").
const MONTHS =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

export function stripDates(input: string): string {
  if (!input) return "";
  let s = input;
  // "23 May 2026" / "23rd May 2026" / "May 23 2026" / "May 2026" / "23 May"
  const patterns: RegExp[] = [
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}\\s+\\d{2,4}\\b`, "gi"),
    new RegExp(`\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?[,\\s]+\\d{2,4}\\b`, "gi"),
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}\\b`, "gi"),
    new RegExp(`\\b${MONTHS}\\s+\\d{2,4}\\b`, "gi"),
    // 2026-05-23 / 2026/05/23
    /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g,
    // 23-05-2026 / 23/05/2026 / 23.05.2026
    /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g,
    // 23-May-2026
    new RegExp(`\\b\\d{1,2}[-/. ]${MONTHS}[-/. ]\\d{2,4}\\b`, "gi"),
  ];
  for (const re of patterns) s = s.replace(re, " ");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // Fix dangling separators created by the removal:
  //   "BS- -MBA"  -> "BS-MBA"
  //   "BS -- MBA" -> "BS - MBA"
  s = s.replace(/([\-\u2013\u2014])\s+([\-\u2013\u2014])/g, "$1");
  s = s.replace(/([\-\u2013\u2014])\s*([\-\u2013\u2014])/g, "$1");
  // Trim leftover separators at edges
  s = s.replace(/^[\s\-\u2013\u2014,.:;]+/, "").replace(/[\s\-\u2013\u2014,.:;]+$/, "");
  return s.replace(/\s+/g, " ").trim();
}

// ---------- Fuzzy student matching ----------

function nameTokens(name: string): string[] {
  return normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

// Jaro-Winkler similarity (0..1). Good for typos and short names.
function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Return true when two display names likely belong to the same student.
 * Handles: partial names ("Nomakhosi" vs "Nomakhosi Ntliziyo"),
 * device-name stripping (done in normalizeName), typos, and case.
 */
export function sameStudent(a: string, b: string, threshold = 0.9): boolean {
  if (!a || !b) return false;
  if (nameKey(a) === nameKey(b)) return true;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  // Every short-side token must fuzzy-match some long-side token.
  return short.every((s) =>
    long.some((l) => (s === l ? true : jaroWinkler(s, l) >= threshold)),
  );
}

/** Pick the fullest / most descriptive of two variants to represent a student. */
export function pickCanonicalName(a: string, b: string): string {
  const ta = nameTokens(a).length;
  const tb = nameTokens(b).length;
  if (ta !== tb) return ta > tb ? a : b;
  return a.length >= b.length ? a : b;
}

export function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
