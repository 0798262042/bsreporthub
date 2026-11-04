import type { Report, StoredSession } from "./types";
import { combineReport } from "./combine";
import { sameStudent, pickCanonicalName, nameKey } from "./normalize";
import { prettyLecturer, prettyModule } from "./topic";

export type StudentRecord = {
  reportId: string;
  reportName: string;
  module: string;
  lecturer: string;
  sessionId: string;
  sessionLabel: string;
  sessionDate: string; // ISO date
  join: Date | null;
  leave: Date | null;
  durationMin: number | null;
  status: "Present" | "Absent";
};

export type StudentSummary = {
  name: string;
  totalSessions: number;
  attended: number;
  avgPct: number | null;
  lastAttended: string | null; // ISO date
};

type ReportIndex = {
  report: Report;
  sessions: StoredSession[];
  hidden: Set<string>;
};

type FullIndex = ReportIndex & { students: ReturnType<typeof combineReport>["students"] };
const indexCache = new WeakMap<Report, FullIndex>();

// Combining a report is expensive (fuzzy clustering), so do it once per report.
function indexReport(report: Report): FullIndex {
  const cached = indexCache.get(report);
  if (cached) return cached;
  const { sessions, students } = combineReport(report.sessions);
  const idx = {
    report,
    sessions,
    students,
    hidden: new Set(report.hiddenNames.map((n) => nameKey(n))),
  };
  indexCache.set(report, idx);
  return idx;
}

function bucketOf(name: string): string {
  return nameKey(name).charAt(0);
}

/** Collect every distinct student name across all reports (fuzzy-clustered). */
export function collectStudentNames(reports: Report[]): string[] {
  // Exact-key dedupe first (cheap), then fuzzy-merge only within buckets
  // sharing the same first letter to avoid an O(n²) scan of every name.
  const byKey = new Map<string, string>();
  for (const report of reports) {
    const idx = indexReport(report);
    for (const s of idx.students) {
      const k = nameKey(s.name);
      if (!k || idx.hidden.has(k)) continue;
      const prev = byKey.get(k);
      byKey.set(k, prev ? pickCanonicalName(prev, s.name) : s.name);
    }
  }
  const buckets = new Map<string, string[]>();
  for (const name of byKey.values()) {
    const b = bucketOf(name);
    const list = buckets.get(b) ?? [];
    const i = list.findIndex((n) => sameStudent(n, name));
    if (i >= 0) list[i] = pickCanonicalName(list[i], name);
    else list.push(name);
    buckets.set(b, list);
  }
  return [...buckets.values()].flat().sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive partial match on any name token or the full name. */
export function filterStudentNames(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return names.filter((n) => {
    const lower = n.toLowerCase();
    if (lower.includes(q)) return true;
    const tokens = lower.split(/[^a-z]+/).filter(Boolean);
    const qTokens = q.split(/[^a-z]+/).filter(Boolean);
    return qTokens.every((qt) => tokens.some((t) => t.startsWith(qt)));
  });
}

/**
 * Build the full attendance record list for one student across every report.
 * Sessions where the student has no join time are included as "Absent" so the
 * history shows the sessions they missed within reports they belong to.
 */
export function getStudentRecords(
  reports: Report[],
  studentName: string,
): StudentRecord[] {
  const records: StudentRecord[] = [];
  for (const report of reports) {
    const idx = indexReport(report);
    const row = idx.students.find(
      (s) => !idx.hidden.has(nameKey(s.name)) && sameStudent(s.name, studentName),
    );
    if (!row) continue; // student never appears in this report
    const module = prettyModule(report.name);
    const lecturer = prettyLecturer(report.name);
    for (const s of idx.sessions) {
      const slot = row.perSession.find((p) => p.sessionId === s.id);
      const join = slot?.join ?? null;
      const leave = slot?.leave ?? null;
      const durationMin =
        join && leave
          ? Math.max(0, Math.round((leave.getTime() - join.getTime()) / 60000))
          : null;
      records.push({
        reportId: report.id,
        reportName: report.name,
        module,
        lecturer,
        sessionId: s.id,
        sessionLabel: s.label,
        sessionDate: s.date,
        join,
        leave,
        durationMin,
        status: join ? "Present" : "Absent",
      });
    }
  }
  return records.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}

export function summarizeStudent(
  name: string,
  records: StudentRecord[],
): StudentSummary {
  const attended = records.filter((r) => r.status === "Present");
  const last = attended.length
    ? attended.reduce((a, b) => (a.sessionDate > b.sessionDate ? a : b))
        .sessionDate
    : null;
  return {
    name,
    totalSessions: records.length,
    attended: attended.length,
    avgPct:
      records.length > 0
        ? Math.round((attended.length / records.length) * 1000) / 10
        : null,
    lastAttended: last,
  };
}

/** Aggregate once, rather than rebuilding every student's full record history. */
export async function getTopStudents(reports: Report[]): Promise<StudentSummary[]> {
  type Totals = { name: string; sessions: Set<string>; attended: Set<string>; last: string | null };
  const byName = new Map<string, Totals>();
  const sessionIds = new Map<string, string>();
  const sessionContent = new Map<string, string>();
  for (const report of reports) {
    const idx = indexReport(report);
    const sessions = new Map(idx.sessions.map((s) => {
      // Reimported sessions may have new IDs or duplicate attendee entries.
      const content = JSON.stringify([s.date, s.topic.trim().toLowerCase().replace(/\s+/g, " "), s.startTime, s.endTime]);
      const key = sessionIds.get(s.id) ?? sessionContent.get(content) ?? s.id;
      sessionIds.set(s.id, key);
      sessionContent.set(content, key);
      return [s.id, { key, date: s.date }] as const;
    }));
    for (const row of idx.students) {
      const key = nameKey(row.name);
      if (!key || idx.hidden.has(key)) continue;
      const totals = byName.get(key) ?? { name: row.name, sessions: new Set<string>(), attended: new Set<string>(), last: null };
      totals.name = pickCanonicalName(totals.name, row.name);
      for (const slot of row.perSession) {
        const s = sessions.get(slot.sessionId);
        if (!s) continue;
        totals.sessions.add(s.key);
        if (slot.join) {
          totals.attended.add(s.key);
          if (!totals.last || s.date > totals.last) totals.last = s.date;
        }
      }
      byName.set(key, totals);
    }
    // Let the input respond while larger repositories are processed.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const students: Totals[] = [];
  let processed = 0;
  for (const totals of byName.values()) {
    const existing = students.find((s) => sameStudent(s.name, totals.name));
    if (existing) {
      existing.name = pickCanonicalName(existing.name, totals.name);
      for (const key of totals.sessions) existing.sessions.add(key);
      for (const key of totals.attended) existing.attended.add(key);
      if (totals.last && (!existing.last || totals.last > existing.last)) existing.last = totals.last;
    } else students.push(totals);
    if (++processed % 25 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return students
    .filter((s) => s.attended.size > 0)
    .sort((a, b) => b.attended.size - a.attended.size || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((s) => ({
      name: s.name,
      totalSessions: s.sessions.size,
      attended: s.attended.size,
      avgPct: s.sessions.size ? Math.round(s.attended.size / s.sessions.size * 1000) / 10 : null,
      lastAttended: s.last,
    }));
}
