import type { Category, Report, StoredSession } from "./types";
import { sessionFingerprint } from "./combine";
import { supabase } from "@/integrations/supabase/client";
import { readAllPages } from "./paged-read";

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nmu-reports-changed"));
  }
}

type DbSession = {
  id: string;
  report_id: string;
  label: string;
  topic: string;
  session_date: string;
  start_time: string;
  end_time: string;
  host_name: string | null;
  host_email: string | null;
  source_filename: string;
  attendees: unknown;
  fingerprint: string;
};

function dbToStored(s: DbSession): StoredSession {
  return {
    id: s.id,
    label: s.label,
    topic: s.topic,
    date: s.session_date,
    startTime: s.start_time,
    endTime: s.end_time,
    hostName: s.host_name ?? undefined,
    hostEmail: s.host_email ?? undefined,
    sourceFilename: s.source_filename,
    attendees: (s.attendees as StoredSession["attendees"]) ?? [],
  };
}

function storedToDb(reportId: string, s: StoredSession) {
  return {
    report_id: reportId,
    label: s.label,
    topic: s.topic,
    session_date: s.date,
    start_time: s.startTime,
    end_time: s.endTime,
    host_name: s.hostName ?? null,
    host_email: s.hostEmail ?? null,
    source_filename: s.sourceFilename,
    attendees: s.attendees,
    fingerprint: sessionFingerprint(s),
  };
}

async function relabelReport(reportId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, label, session_date")
    .eq("report_id", reportId)
    .order("session_date", { ascending: true });
  if (error) throw error;
  if (!data) return;
  const changed = data.map((s, i) => ({ ...s, label: `Session ${i + 1}`, changed: s.label !== `Session ${i + 1}` })).filter((s) => s.changed);
  // Skip unchanged labels and bound concurrent writes for large modules.
  for (let offset = 0; offset < changed.length; offset += 8) {
    await Promise.all(changed.slice(offset, offset + 8).map(async (s) => {
      const result = await supabase.from("sessions").update({ label: s.label }).eq("id", s.id);
      if (result.error) throw result.error;
    }));
  }
}

async function touchReport(id: string) {
  // The trigger auto-sets updated_at on any UPDATE. Bump it explicitly so the
  // list reorders after adding/removing sessions.
  const { error } = await supabase
    .from("reports")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function listReportCategories(): Promise<{ category: string }[]> {
  return readAllPages((from, to) => supabase.from("reports").select("category").order("id").range(from, to));
}

export async function listReports(category?: string): Promise<Report[]> {
  const reports = await readAllPages((from, to) => {
    let query = supabase.from("reports").select("id, name, category, hidden_names, created_at, updated_at").order("updated_at", { ascending: false }).order("id");
    if (category) query = query.eq("category", category);
    return query.range(from, to);
  });
  const ids = reports.map((r) => r.id);
  const sessions: DbSession[] = [];
  // Bound IN filters and payloads; never truncate a student's attendance history.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = await readAllPages((from, to) => supabase.from("sessions").select("*").in("report_id", ids.slice(offset, offset + 100)).order("id").range(from, to));
    sessions.push(...batch);
  }
  const byReport = new Map<string, StoredSession[]>();
  for (const s of sessions) {
    const list = byReport.get(s.report_id) ?? [];
    list.push(dbToStored(s));
    byReport.set(s.report_id, list);
  }
  return reports.map((r) => ({
    id: r.id,
    name: r.name,
    category: (r.category as Category) ?? "MBA",
    hiddenNames: Array.isArray(r.hidden_names) ? (r.hidden_names as string[]) : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sessions: byReport.get(r.id) ?? [],
  }));
}

export async function getReport(id: string): Promise<Report | null> {
  const { data: r, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!r) return null;
  const sessions = await readAllPages((from, to) => supabase.from("sessions").select("*").eq("report_id", id).order("id").range(from, to));
  return {
    id: r.id,
    name: r.name,
    category: (r.category as Category) ?? "MBA",
    hiddenNames: Array.isArray(r.hidden_names) ? (r.hidden_names as string[]) : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sessions: ((sessions ?? []) as DbSession[]).map(dbToStored),
  };
}

export async function createReport(
  name: string,
  category: Category = "MBA",
): Promise<Report | null> {
  const { data } = await supabase
    .from("reports")
    .insert({ name: name.trim() || "Untitled Report", category })
    .select()
    .single();
  if (!data) return null;
  emit();
  return {
    id: data.id,
    name: data.name,
    category: (data.category as Category) ?? category,
    hiddenNames: [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    sessions: [],
  };
}

export async function setHiddenNames(id: string, names: string[]) {
  await supabase
    .from("reports")
    .update({ hidden_names: names, updated_at: new Date().toISOString() })
    .eq("id", id);
  emit();
}

export async function deleteReport(id: string) {
  await supabase.from("reports").delete().eq("id", id);
  emit();
}

export async function renameReport(id: string, name: string) {
  await supabase
    .from("reports")
    .update({ name: name.trim() || "Untitled Report" })
    .eq("id", id);
  emit();
}

export async function addSessions(id: string, newSessions: StoredSession[]) {
  if (newSessions.length === 0) return;
  const rows = newSessions.map((s) => storedToDb(id, s));
  const { error } = await supabase.from("sessions").insert(rows);
  if (error) throw new Error("Could not save attendance. Please try again.");
  await relabelReport(id);
  await touchReport(id);
  emit();
}

export async function removeSession(id: string, sessionId: string) {
  await supabase.from("sessions").delete().eq("id", sessionId);
  await relabelReport(id);
  await touchReport(id);
  emit();
}

export async function findDuplicateSessions(
  reportId: string,
  candidates: StoredSession[],
): Promise<StoredSession[]> {
  const fps = candidates.map(sessionFingerprint);
  if (fps.length === 0) return [];
  const { data } = await supabase
    .from("sessions")
    .select("fingerprint")
    .eq("report_id", reportId)
    .in("fingerprint", fps);
  const existing = new Set((data ?? []).map((d) => d.fingerprint));
  return candidates.filter((c) => existing.has(sessionFingerprint(c)));
}

export async function findReportContainingSessions(
  candidates: StoredSession[],
): Promise<{ report: Report; matched: StoredSession[] } | null> {
  const fps = candidates.map(sessionFingerprint);
  if (fps.length === 0) return null;
  const { data } = await supabase
    .from("sessions")
    .select("report_id, fingerprint")
    .in("fingerprint", fps);
  if (!data || data.length === 0) return null;
  const reportId = data[0].report_id;
  const report = await getReport(reportId);
  if (!report) return null;
  const matchedFps = new Set(
    data.filter((d) => d.report_id === reportId).map((d) => d.fingerprint),
  );
  return {
    report,
    matched: candidates.filter((c) => matchedFps.has(sessionFingerprint(c))),
  };
}
