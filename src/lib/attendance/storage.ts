import type { Report, StoredSession } from "./types";

const KEY = "nmu-attendance-reports-v1";

function safeParse(): Report[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Report[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(reports: Report[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(reports));
  window.dispatchEvent(new CustomEvent("nmu-reports-changed"));
}

export function listReports(): Report[] {
  return safeParse().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getReport(id: string): Report | null {
  return safeParse().find((r) => r.id === id) ?? null;
}

export function createReport(name: string): Report {
  const now = new Date().toISOString();
  const report: Report = {
    id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Untitled Report",
    createdAt: now,
    updatedAt: now,
    sessions: [],
  };
  const all = safeParse();
  all.push(report);
  save(all);
  return report;
}

export function updateReport(
  id: string,
  updater: (r: Report) => Report,
): Report | null {
  const all = safeParse();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const updated = { ...updater(all[idx]), updatedAt: new Date().toISOString() };
  all[idx] = updated;
  save(all);
  return updated;
}

export function deleteReport(id: string) {
  save(safeParse().filter((r) => r.id !== id));
}

export function addSessions(id: string, newSessions: StoredSession[]): Report | null {
  return updateReport(id, (r) => ({
    ...r,
    sessions: [...r.sessions, ...newSessions],
  }));
}

export function removeSession(id: string, sessionId: string): Report | null {
  return updateReport(id, (r) => ({
    ...r,
    sessions: r.sessions.filter((s) => s.id !== sessionId),
  }));
}

export function renameSession(
  id: string,
  sessionId: string,
  label: string,
): Report | null {
  return updateReport(id, (r) => ({
    ...r,
    sessions: r.sessions.map((s) =>
      s.id === sessionId ? { ...s, label } : s,
    ),
  }));
}

export function renameReport(id: string, name: string): Report | null {
  return updateReport(id, (r) => ({ ...r, name: name.trim() || r.name }));
}
