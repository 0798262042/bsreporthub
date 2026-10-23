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

function indexReport(report: Report): ReportIndex {
  const { sessions } = combineReport(report.sessions);
  return {
    report,
    sessions,
    hidden: new Set(report.hiddenNames.map((n) => nameKey(n))),
  };
}

/** Collect every distinct student name across all reports (fuzzy-clustered). */
export function collectStudentNames(reports: Report[]): string[] {
  const names: string[] = [];
  for (const report of reports) {
    const idx = indexReport(report);
    const { students } = combineReport(report.sessions);
    for (const s of students) {
      if (idx.hidden.has(nameKey(s.name))) continue;
      const existing = names.find((n) => sameStudent(n, s.name));
      if (existing) {
        const better = pickCanonicalName(existing, s.name);
        if (better !== existing) names[names.indexOf(existing)] = better;
      } else {
        names.push(s.name);
      }
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
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
    const { students } = combineReport(report.sessions);
    const row = students.find(
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
