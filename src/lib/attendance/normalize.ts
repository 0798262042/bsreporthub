// Name normalization + time formatting helpers

export function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = raw.trim().replace(/\s+/g, " ");
  // strip trailing parenthetical alias: "Nomkhosi Mhlahlo (Nunu Mhlahlo)"
  s = s.replace(/\s*\([^)]*\)\s*$/g, "").trim();
  // strip trailing numeric IDs: "Chumasande Sive Myendeki 212293818"
  s = s.replace(/\s+\d{5,}$/g, "").trim();
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
