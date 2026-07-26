import type { Report, StoredSession, StudentRow } from "./types";
import { sameStudent, pickCanonicalName } from "./normalize";

export function toStoredSession(s: import("./types").SessionData): StoredSession {
  return {
    ...s,
    attendees: s.attendees.map((a) => ({
      name: a.name,
      rawName: a.rawName,
      joinTime: a.joinTime.toISOString(),
      leaveTime: a.leaveTime.toISOString(),
    })),
  };
}

export function combineReport(sessions: StoredSession[]): {
  students: StudentRow[];
  sessions: StoredSession[];
} {
  const ordered = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s, i) => ({ ...s, label: `Session ${i + 1}` }));
  // Fuzzy-cluster attendees across sessions so that "Nomakhosi",
  // "Nomakhosi Ntliziyo" and "Nomakhosi's iPhone" collapse into a
  // single student row with earliest join and latest leave.
  const rows: StudentRow[] = [];
  for (const s of ordered) {
    for (const att of s.attendees) {
      let row = rows.find((r) => sameStudent(r.name, att.name));
      if (!row) {
        row = {
          name: att.name,
          perSession: ordered.map((os) => ({
            sessionId: os.id,
            join: null,
            leave: null,
          })),
          attended: 0,
          attendancePct: 0,
        };
        rows.push(row);
      } else {
        row.name = pickCanonicalName(row.name, att.name);
      }
      const slot = row.perSession.find((p) => p.sessionId === s.id);
      if (slot) {
        const j = new Date(att.joinTime);
        const l = new Date(att.leaveTime);
        if (!slot.join || j < slot.join) slot.join = j;
        if (!slot.leave || l > slot.leave) slot.leave = l;
      }
    }
  }

  const total = ordered.length || 1;
  const students = rows
    .map((r) => {
      r.attended = r.perSession.filter((p) => p.join !== null).length;
      r.attendancePct = Math.round((r.attended / total) * 1000) / 10;
      return r;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { students, sessions: ordered };
}

export function computeStats(students: StudentRow[], sessionCount: number) {
  if (students.length === 0) {
    return {
      totalStudents: 0,
      totalSessions: sessionCount,
      avg: 0,
      highest: 0,
      lowest: 0,
      perfect: 0,
      absent: 0,
    };
  }
  const pcts = students.map((s) => s.attendancePct);
  const avg = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10;
  return {
    totalStudents: students.length,
    totalSessions: sessionCount,
    avg,
    highest: Math.max(...pcts),
    lowest: Math.min(...pcts),
    perfect: students.filter((s) => s.attendancePct === 100).length,
    absent: students.filter((s) => s.attended === 0).length,
  };
}

export function relabelSessions(sessions: StoredSession[]): StoredSession[] {
  return sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s, i) => ({ ...s, label: `Session ${i + 1}` }));
}

// Fingerprint identifies a session by its meaningful content so the same
// Zoom export cannot be added to a report twice.
export function sessionFingerprint(s: StoredSession): string {
  const topic = (s.topic || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${s.date}|${topic}|${s.attendees.length}`;
}

export function reportDateRange(sessions: StoredSession[]): string {
  if (sessions.length === 0) return "—";
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const first = fmt(sorted[0].date);
  const last = fmt(sorted[sorted.length - 1].date);
  return first === last ? first : `${first} — ${last}`;
}

export type ReportSummary = Pick<Report, "id" | "name" | "createdAt" | "updatedAt"> & {
  sessionCount: number;
  studentCount: number;
};
