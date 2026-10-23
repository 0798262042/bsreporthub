// Shared Zoom-topic parsing helpers (module / lecturer extraction).
// Mirrors the logic used on the report page so every surface derives the
// same module and lecturer names from a topic string.

// Drop trailing/inline time ranges such as "17:30 TO 20:30" or "5:00 PM - 8:00 PM"
// so they are never mistaken for a lecturer or module name.
export function stripTimeRanges(topic: string): string {
  return (topic || "")
    .replace(
      /\b\d{1,2}[:.]\d{2}\s*(?:am|pm)?\s*(?:-|–|—|to|until|till)\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–—:]+$/g, "")
    .trim();
}

// Split a Zoom topic into its dash-separated chunks. Handles "A – B", "A - B"
// and the common "BARF501 -Michael De Lange" (no space after the dash).
export function topicParts(topic: string): string[] {
  const t = stripTimeRanges(topic);
  if (!t) return [];
  return t
    .split(/\s*[–—]\s*|\s+-\s*|\s*-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// The lecturer name is the last dash-separated chunk of the topic.
export function prettyLecturer(topic: string): string {
  const parts = topicParts(topic);
  return parts[parts.length - 1] || stripTimeRanges(topic);
}

// The module is the middle chunk(s) between the "BS-<date>" prefix and the
// lecturer name.
export function prettyModule(topic: string): string {
  const t = stripTimeRanges(topic);
  const parts = topicParts(topic);
  let mod: string;
  if (parts.length >= 3) mod = parts.slice(1, -1).join(" — ");
  else if (parts.length === 2) mod = parts[0];
  else mod = t;
  mod = mod
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm)?\s*[-–—to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–—]+$/g, "")
    .trim();
  return mod;
}
