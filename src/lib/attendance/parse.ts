import * as XLSX from "xlsx";
import { normalizeName, nameKey } from "./normalize";
import type { AttendanceRow, SessionData } from "./types";

// Parse Zoom-style datetimes like "07/06/2026 04:47:51 PM".
// Zoom exports typically use MM/DD/YYYY in the US and DD/MM/YYYY elsewhere.
// We try MM/DD/YYYY first, then DD/MM/YYYY; fall back to Date parsing.
function parseDateTime(input: unknown): Date | null {
  if (input == null || input === "") return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(input);
    if (d) return new Date(d.y, d.m - 1, d.d, d.H, d.M, Math.floor(d.S));
  }
  const s = String(input).trim();
  const m = s.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/,
  );
  if (m) {
    let [, a, b, y, hh, mm, ss, ap] = m;
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    let hour = parseInt(hh, 10);
    if (ap) {
      const isPm = ap.toUpperCase() === "PM";
      if (hour === 12) hour = isPm ? 12 : 0;
      else if (isPm) hour += 12;
    }
    const minute = parseInt(mm, 10);
    const second = ss ? parseInt(ss, 10) : 0;
    const A = parseInt(a, 10);
    const B = parseInt(b, 10);
    // Prefer MM/DD if A <= 12 and B > 12; DD/MM if A > 12; otherwise MM/DD (Zoom US default)
    let month: number, day: number;
    if (A > 12) {
      day = A;
      month = B;
    } else if (B > 12) {
      month = A;
      day = B;
    } else {
      // ambiguous - default MM/DD
      month = A;
      day = B;
    }
    return new Date(year, month - 1, day, hour, minute, second);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function findHeaderRow(rows: unknown[][], keywords: string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const joined = row.map((c) => String(c ?? "").toLowerCase()).join("|");
    if (keywords.every((k) => joined.includes(k))) return i;
  }
  return -1;
}

export type ParsedFile = {
  sessions: SessionData[];
  warnings: string[];
};

export async function parseAttendanceFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
  const warnings: string[] = [];
  const sessions: SessionData[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
    });

    // Session meta header
    const metaIdx = findHeaderRow(rows, ["topic", "start time"]);
    let topic = file.name.replace(/\.(xlsx?|csv)$/i, "");
    let startTime = "";
    let endTime = "";
    let hostName = "";
    let hostEmail = "";
    if (metaIdx >= 0 && rows[metaIdx + 1]) {
      const meta = rows[metaIdx + 1] as (string | number)[];
      const header = (rows[metaIdx] as string[]).map((h) =>
        String(h ?? "").toLowerCase(),
      );
      const get = (key: string) => {
        const i = header.findIndex((h) => h.includes(key));
        return i >= 0 ? String(meta[i] ?? "") : "";
      };
      topic = get("topic") || topic;
      const startRaw = get("start time");
      const endRaw = get("end time");
      const startD = parseDateTime(startRaw);
      const endD = parseDateTime(endRaw);
      startTime = startD ? startD.toISOString() : "";
      endTime = endD ? endD.toISOString() : "";
      const hostRaw = get("host");
      const hm = hostRaw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (hm) {
        hostName = hm[1].trim();
        hostEmail = hm[2].trim();
      } else {
        hostName = hostRaw;
      }
    }

    // Attendee header
    const attIdx = findHeaderRow(rows, ["name", "join time", "leave time"]);
    if (attIdx < 0) {
      warnings.push(`Sheet "${sheetName}" is missing attendance columns; skipped.`);
      continue;
    }
    const attHeader = (rows[attIdx] as string[]).map((h) =>
      String(h ?? "").toLowerCase(),
    );
    const col = {
      name: attHeader.findIndex((h) => h.includes("name")),
      email: attHeader.findIndex((h) => h.includes("email")),
      join: attHeader.findIndex((h) => h.includes("join")),
      leave: attHeader.findIndex((h) => h.includes("leave")),
    };

    const hostKey = hostName ? nameKey(hostName) : "";
    const hostEmailLc = hostEmail.toLowerCase();

    // Merge per person (earliest join, latest leave)
    const merged = new Map<string, AttendanceRow>();
    for (let i = attIdx + 1; i < rows.length; i++) {
      const r = rows[i] as (string | number)[];
      if (!r || r.every((c) => c === "" || c == null)) continue;
      const rawName = String(r[col.name] ?? "").trim();
      if (!rawName) continue;
      const email = col.email >= 0 ? String(r[col.email] ?? "").trim() : "";
      // Exclude host row
      if (
        (hostEmailLc && email.toLowerCase() === hostEmailLc) ||
        (hostKey && nameKey(rawName) === hostKey)
      ) {
        continue;
      }
      const join = parseDateTime(r[col.join]);
      const leave = parseDateTime(r[col.leave]);
      if (!join || !leave) continue;
      const normalized = normalizeName(rawName);
      if (!normalized) continue;
      const key = nameKey(normalized);
      const existing = merged.get(key);
      if (existing) {
        if (join < existing.joinTime) existing.joinTime = join;
        if (leave > existing.leaveTime) existing.leaveTime = leave;
      } else {
        merged.set(key, {
          name: normalized,
          rawName,
          joinTime: join,
          leaveTime: leave,
        });
      }
    }

    if (merged.size === 0) {
      warnings.push(`Sheet "${sheetName}" had no attendee rows.`);
      continue;
    }

    // Derive session date from earliest join if start time missing
    let dateIso = "";
    if (startTime) {
      dateIso = startTime.slice(0, 10);
    } else {
      const earliest = [...merged.values()].reduce(
        (min, r) => (r.joinTime < min ? r.joinTime : min),
        [...merged.values()][0].joinTime,
      );
      dateIso = earliest.toISOString().slice(0, 10);
      startTime = earliest.toISOString();
    }

    sessions.push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      label: "",
      topic,
      date: dateIso,
      startTime,
      endTime,
      hostName,
      hostEmail,
      attendees: [...merged.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      sourceFilename: file.name,
    });
  }

  return { sessions, warnings };
}
