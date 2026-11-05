import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Search,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react";
import { BrandHeader } from "@/components/attendance/BrandHeader";
import { Landing } from "@/components/Landing";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useReports } from "@/hooks/use-reports";
import { formatDate, formatTime } from "@/lib/attendance/normalize";
import {
  filterStudentNames,
  summarizeStudent,
  type StudentRecord,
  type StudentSummary,
} from "@/lib/attendance/student-search";
import { toast } from "sonner";

export const Route = createFileRoute("/student-search")({
  head: () => ({
    meta: [
      { title: "Find a Student — Attendra" },
      {
        name: "description",
        content:
          "Search for a student and view their attendance history across all NMU Business School modules, sessions and reports.",
      },
      { property: "og:title", content: "Find a Student — Attendra" },
      {
        property: "og:description",
        content:
          "Search for a student and view their attendance history across all NMU Business School modules, sessions and reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentSearchPage,
});

function StudentSearchPage() {
  const { session } = useAuth();
  const { reports, loading, error, refresh } = useReports();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [topStudents, setTopStudents] = useState<StudentSummary[] | null>(null);
  const [allNames, setAllNames] = useState<string[]>([]);
  const [recordResult, setRecordResult] = useState<{ name: string; records: StudentRecord[] } | null>(null);
  const searchWorker = useRef<Worker | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [lecturerFilter, setLecturerFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (loading) return;
    const worker = new Worker(new URL("../lib/attendance/search.worker.ts", import.meta.url), { type: "module" });
    searchWorker.current = worker;
    setAllNames([]);
    setRecordResult(null);
    setTopStudents(null);
    worker.onmessage = (event: MessageEvent<{ type: string; names: string[]; students: StudentSummary[]; name: string; records: StudentRecord[] }>) => {
      if (event.data.type === "names") setAllNames(event.data.names);
      else if (event.data.type === "ranking") setTopStudents(event.data.students);
      else if (event.data.type === "records") setRecordResult({ name: event.data.name, records: event.data.records });
      else toast.error("Could not calculate attendance. Please reload and try again.");
    };
    worker.onerror = () => toast.error("Could not prepare student search. Please reload and try again.");
    worker.postMessage({ type: "init", reports });
    return () => { worker.terminate(); searchWorker.current = null; };
  }, [reports, loading]);
  useEffect(() => {
    if (selected) searchWorker.current?.postMessage({ type: "student", name: selected });
  }, [selected, reports, loading]);

  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(
    () => filterStudentNames(allNames, deferredQuery).slice(0, 12),
    [allNames, deferredQuery],
  );

  const allRecords = useMemo(
    () => (recordResult?.name === selected ? recordResult.records : []),
    [recordResult, selected],
  );

  const modules = useMemo(
    () => [...new Set(allRecords.map((r) => r.module))].sort(),
    [allRecords],
  );
  const lecturers = useMemo(
    () => [...new Set(allRecords.map((r) => r.lecturer))].sort(),
    [allRecords],
  );
  const sessionLabels = useMemo(
    () => [...new Set(allRecords.map((r) => r.sessionLabel))].sort(),
    [allRecords],
  );

  const filtered = useMemo(
    () =>
      allRecords.filter((r) => {
        if (startDate && r.sessionDate < startDate) return false;
        if (endDate && r.sessionDate > endDate) return false;
        if (moduleFilter && r.module !== moduleFilter) return false;
        if (lecturerFilter && r.lecturer !== lecturerFilter) return false;
        if (sessionFilter && r.sessionLabel !== sessionFilter) return false;
        return true;
      }),
    [allRecords, startDate, endDate, moduleFilter, lecturerFilter, sessionFilter],
  );

  const summary = useMemo(
    () => (selected ? summarizeStudent(selected, filtered) : null),
    [selected, filtered],
  );

  const hasFilters =
    !!startDate || !!endDate || !!moduleFilter || !!lecturerFilter || !!sessionFilter;

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setModuleFilter("");
    setLecturerFilter("");
    setSessionFilter("");
  }

  function pickStudent(name: string) {
    setSelected(name);
    setQuery("");
    clearFilters();
  }

  async function handleExport(kind: "excel" | "pdf") {
    if (!summary || filtered.length === 0) return;
    setExporting(true);
    try {
      const { exportStudentExcel, exportStudentPdf } = await import("@/lib/attendance/export-student");
      if (kind === "excel") exportStudentExcel(summary, filtered);
      else await exportStudentPdf(summary, filtered);
      toast.success(
        kind === "excel" ? "Excel report downloaded." : "PDF report downloaded.",
      );
    } catch {
      toast.error("Could not generate the export. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (!session) return <Landing />;
  if (loading) return <LoadingScreen />;
  if (error) return <div role="alert" className="p-8"><p>Could not load attendance. Please try again.</p><Button onClick={refresh}>Try again</Button></div>;

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Find a Student
            </h1>
            <p className="text-sm text-muted-foreground">
              Find a student and view their attendance across every module and
              session.
            </p>
          </div>
        </div>

        {/* Search box */}
        <div className="relative mt-8 w-full max-w-3xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              clearFilters();
            }}
            placeholder="Search student by full name..."
            className="pl-9"
          />
          {query.trim() && (
            <div className="absolute z-20 mt-2 w-full rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)]">
              {matches.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No student matches “{query.trim()}”. Check the spelling and try
                  again.
                </p>
              ) : (
                <ul className="max-h-72 overflow-auto py-1">
                  {matches.map((name) => (
                    <li key={name}>
                      <button
                        onClick={() => pickStudent(name)}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-accent"
                      >
                        <GraduationCap className="h-4 w-4 text-primary" />
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {!selected && !query.trim() && (
          <section className="mt-6 w-full max-w-3xl" aria-labelledby="top-students-heading" aria-busy={topStudents === null}>
            <h2 id="top-students-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Trophy className="h-5 w-5 shrink-0 text-primary" />
              Top 5 Most Attending Students
            </h2>
            {topStudents === null ? (
              <p className="mt-4 text-sm text-muted-foreground" role="status">Loading attendance rankings…</p>
            ) : topStudents.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No student attendance records available yet.</p>
            ) : (
              <ol className="mt-4 divide-y divide-border border-y border-border">
                {topStudents.map((student, index) => (
                  <li key={student.name} className="flex items-center gap-3 py-4 sm:gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                    <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">{student.name}</span>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{student.attended} {student.attended === 1 ? "session" : "sessions"}</p>
                      {student.avgPct !== null && <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{student.avgPct}% attendance</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {selected && summary && (
          <div className="mt-8 space-y-8">
            {/* Summary cards */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {summary.name}
                </h2>
                <Button
                  variant="link"
                  onClick={() => { setSelected(null); setQuery(""); clearFilters(); }}
                  className="mt-1 h-auto p-0 text-sm font-medium text-primary hover:underline"
                >
                  ← Search for another student
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporting || filtered.length === 0}
                  onClick={() => handleExport("excel")}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export to Excel
                </Button>
                <Button
                  size="sm"
                  disabled={exporting || filtered.length === 0}
                  onClick={() => handleExport("pdf")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export to PDF
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Total Sessions Recorded"
                value={String(summary.totalSessions)}
              />
              <SummaryCard
                label="Sessions Attended"
                value={String(summary.attended)}
              />
              <SummaryCard
                label="Average Attendance"
                value={summary.avgPct != null ? `${summary.avgPct}%` : "—"}
              />
              <SummaryCard
                label="Most Recent Attendance"
                value={
                  summary.lastAttended ? formatDate(summary.lastAttended) : "—"
                }
              />
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs font-medium text-muted-foreground">
                  Start date
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  End date
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Module
                  <select
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">All modules</option>
                    {modules.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Lecturer
                  <select
                    value={lecturerFilter}
                    onChange={(e) => setLecturerFilter(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">All lecturers</option>
                    {lecturers.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Session
                  <select
                    value={sessionFilter}
                    onChange={(e) => setSessionFilter(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="">All sessions</option>
                    {sessionLabels.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-3"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Records table */}
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No attendance records match the current filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <Th>Module</Th>
                      <Th>Lecturer</Th>
                      <Th>Session</Th>
                      <Th>Date</Th>
                      <Th>Join</Th>
                      <Th>Leave</Th>
                      <Th>Duration</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <RecordRow key={`${r.reportId}-${r.sessionId}`} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
      {children}
    </th>
  );
}

function RecordRow({ r }: { r: StudentRecord }) {
  return (
    <tr className="border-t border-border/60 odd:bg-card even:bg-accent/40">
      <td className="px-4 py-2.5 text-foreground">{r.module}</td>
      <td className="px-4 py-2.5 text-foreground">{r.lecturer}</td>
      <td className="px-4 py-2.5 text-foreground">{r.sessionLabel}</td>
      <td className="px-4 py-2.5 text-foreground">{formatDate(r.sessionDate)}</td>
      <td className="px-4 py-2.5 text-foreground">
        {r.join ? formatTime(r.join) : "—"}
      </td>
      <td className="px-4 py-2.5 text-foreground">
        {r.leave ? formatTime(r.leave) : "—"}
      </td>
      <td className="px-4 py-2.5 text-foreground">
        {r.durationMin != null ? `${r.durationMin} min` : "—"}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            r.status === "Present"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {r.status === "Present" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {r.status}
        </span>
      </td>
    </tr>
  );
}
