import type { Category, Report, StoredSession } from "./types";
import { sessionFingerprint } from "./combine";
import { supabase } from "@/integrations/supabase/client";

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
  const { data } = await supabase
    .from("sessions")
    .select("id, session_date")
    .eq("report_id", reportId)
    .order("session_date", { ascending: true });
  if (!data) return;
  await Promise.all(
    data.map((s, i) =>
      supabase.from("sessions").update({ label: `Session ${i + 1}` }).eq("id", s.id),
    ),
  );
}

async function touchReport(id: string) {
  // The trigger auto-sets updated_at on any UPDATE. Bump it explicitly so the
  // list reorders after adding/removing sessions.
  await supabase
    .from("reports")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function listReports(): Promise<Report[]> {
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!reports) return [];
  const ids = reports.map((r) => r.id);
  const sessionsRes =
    ids.length > 0
      ? await supabase.from("sessions").select("*").in("report_id", ids)
      : { data: [] as DbSession[] };
  const byReport = new Map<string, StoredSession[]>();
  for (const s of (sessionsRes.data ?? []) as DbSession[]) {
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
  const { data: r } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("report_id", id);
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
  await supabase.from("sessions").insert(rows);
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
