import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { BrandHeader } from "@/components/attendance/BrandHeader";
import { Landing } from "@/components/Landing";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { listReports } from "@/lib/attendance/storage";
import type { Report } from "@/lib/attendance/types";
import { formatDate, formatTime } from "@/lib/attendance/normalize";
import {
  collectStudentNames,
  filterStudentNames,
  getStudentRecords,
  summarizeStudent,
  type StudentRecord,
} from "@/lib/attendance/student-search";
import {
  exportStudentExcel,
  exportStudentPdf,
} from "@/lib/attendance/export-student";
import { toast } from "sonner";

export const Route = createFileRoute("/student-search")({
  head: () => ({
    meta: [
      { title: "Student Attendance Search — Attendra" },
      {
        name: "description",
        content:
          "Search for a student and view their attendance history across all NMU Business School modules, sessions and reports.",
      },
      { property: "og:title", content: "Student Attendance Search — Attendra" },
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
  const [reports, setReports] = useState<Report[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [lecturerFilter, setLecturerFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!session) return;
    listReports()
      .then(setReports)
      .catch(() => setReports([]));
  }, [session]);

  const allNames = useMemo(
    () => (reports ? collectStudentNames(reports) : []),
    [reports],
  );

  const matches = useMemo(
    () => filterStudentNames(allNames, query).slice(0, 12),
    [allNames, query],
  );

  const allRecords = useMemo(
    () => (reports && selected ? getStudentRecords(reports, selected) : []),
    [reports, selected],
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
  if (reports === null) return <LoadingScreen />;

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
              Student Attendance Search
            </h1>
            <p className="text-sm text-muted-foreground">
              Find a student and view their attendance across every module and
              session.
            </p>
          </div>
        </div>

        {/* Search box */}
        <div className="relative mt-8 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

        {!selected && (
          <p className="mt-6 text-sm text-muted-foreground">
            Type a name above to search across all uploaded reports.
          </p>
        )}

        {selected && summary && (
          <div className="mt-8 space-y-8">
            {/* Summary cards */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {summary.name}
                </h2>
                <button
                  onClick={() => setSelected(null)}
                  className="mt-1 text-sm font-medium text-primary hover:underline"
                >
                  ← Search for another student
                </button>
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
