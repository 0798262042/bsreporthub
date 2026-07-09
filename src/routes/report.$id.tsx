import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  Calendar,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BrandHeader } from "@/components/attendance/BrandHeader";
import { UploadDropzone } from "@/components/attendance/UploadDropzone";
import { useReport } from "@/hooks/use-reports";
import {
  addSessions,
  removeSession,
  renameReport,
  findDuplicateSessions,
} from "@/lib/attendance/storage";
import { parseAttendanceFile } from "@/lib/attendance/parse";
import {
  combineReport,
  computeStats,
  reportDateRange,
  toStoredSession,
} from "@/lib/attendance/combine";
import { formatDate, formatTime } from "@/lib/attendance/normalize";
import { exportReportExcel } from "@/lib/attendance/export-excel";
import { exportReportPdf } from "@/lib/attendance/export-pdf";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/report/$id")({
  head: () => ({
    meta: [
      { title: "Attendance Report — NMU Business School" },
      {
        name: "description",
        content: "View, filter and export a combined attendance report.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { report } = useReport(id);

  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [minPct, setMinPct] = useState(0);
  const [renamingReport, setRenamingReport] = useState(false);
  const [reportNameDraft, setReportNameDraft] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const fullCombined = useMemo(() => {
    if (!report) return null;
    return combineReport(report.sessions);
  }, [report]);

  // Apply date-range filter on top of the combined report.
  const combined = useMemo(() => {
    if (!fullCombined) return null;
    if (!dateRange?.from && !dateRange?.to) return fullCombined;
    const from = dateRange.from ? dateRange.from.toISOString().slice(0, 10) : null;
    const to = dateRange.to ? dateRange.to.toISOString().slice(0, 10) : from;
    const kept = fullCombined.sessions.filter((s) => {
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    });
    const keptIds = new Set(kept.map((s) => s.id));
    const total = kept.length || 1;
    const students = fullCombined.students
      .map((r) => {
        const perSession = r.perSession.filter((p) => keptIds.has(p.sessionId));
        const attended = perSession.filter((p) => p.join !== null).length;
        return {
          ...r,
          perSession,
          attended,
          attendancePct: Math.round((attended / total) * 1000) / 10,
        };
      })
      .filter((r) => r.perSession.length > 0);
    return { sessions: kept, students };
  }, [fullCombined, dateRange]);

  const stats = useMemo(() => {
    if (!combined) return null;
    return computeStats(combined.students, combined.sessions.length);
  }, [combined]);

  const filteredStudents = useMemo(() => {
    if (!combined) return [];
    const q = search.trim().toLowerCase();
    return combined.students.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q)) && s.attendancePct >= minPct,
    );
  }, [combined, search, minPct]);

  if (!report) {
    return (
      <div className="min-h-screen">
        <BrandHeader />
        <main className="mx-auto max-w-7xl px-6 py-16 text-center">
          <p className="text-lg font-semibold">Report not found</p>
          <p className="mt-2 text-muted-foreground">
            It may have been deleted from this browser.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Back home</Link>
          </Button>
        </main>
      </div>
    );
  }

  const handleUpload = async (files: File[]) => {
    setBusy(true);
    try {
      const stored = [];
      for (const f of files) {
        const parsed = await parseAttendanceFile(f);
        parsed.warnings.forEach((w) => toast.warning(w));
        for (const s of parsed.sessions) stored.push(toStoredSession(s));
      }
      if (stored.length === 0) {
        toast.error("No attendance data found in the uploaded file(s).");
        return;
      }
      const dupes = await findDuplicateSessions(id, stored);
      const dupSet = new Set(dupes.map((d) => `${d.date}|${d.topic}`));
      const fresh = stored.filter((s) => !dupSet.has(`${s.date}|${s.topic}`));
      if (dupes.length) {
        toast.error(
          `Skipped ${dupes.length} duplicate session(s) already in this report.`,
        );
      }
      if (fresh.length === 0) return;
      await addSessions(id, fresh);
      toast.success(`Added ${fresh.length} session(s).`);
    } catch (e) {
      console.error(e);
      toast.error("Could not parse one of the files.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    removeSession(id, sessionId);
    toast.success("Session removed");
  };

  const dateRangeLabel = reportDateRange(report.sessions);

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 text-muted-foreground"
              onClick={() => navigate({ to: "/" })}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              All reports
            </Button>
            {renamingReport ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  autoFocus
                  value={reportNameDraft}
                  onChange={(e) => setReportNameDraft(e.target.value)}
                  className="text-2xl font-bold h-11"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameReport(id, reportNameDraft);
                      setRenamingReport(false);
                    }
                    if (e.key === "Escape") setRenamingReport(false);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    renameReport(id, reportNameDraft);
                    setRenamingReport(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRenamingReport(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{report.name}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setReportNameDraft(report.name);
                    setRenamingReport(true);
                  }}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> {dateRangeLabel}
              </span>
              <span>Generated {new Date().toLocaleDateString()}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={combined!.students.length === 0}
              onClick={() =>
                exportReportExcel(report.name, combined!.sessions, combined!.students)
              }
            >
              <Download className="h-4 w-4 mr-1.5" /> Excel
            </Button>
            <Button
              className="bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]"
              disabled={combined!.students.length === 0}
              onClick={() =>
                exportReportPdf(report.name, combined!.sessions, combined!.students)
              }
            >
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        {/* Dashboard */}
        {stats && (
          <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Students" value={stats.totalStudents} />
            <StatCard label="Sessions" value={stats.totalSessions} />
            <StatCard label="Average" value={`${stats.avg}%`} tone="brand" />
            <StatCard label="Highest" value={`${stats.highest}%`} tone="success" />
            <StatCard label="Lowest" value={`${stats.lowest}%`} tone="warn" />
            <StatCard label="Perfect" value={stats.perfect} tone="success" />
            <StatCard label="Absent" value={stats.absent} tone="danger" />
          </section>
        )}

        {/* Sessions */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sessions
            </h2>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <CalendarRange className="h-4 w-4 mr-1.5" />
                    {dateRange?.from
                      ? dateRange.to
                        ? `${formatDate(dateRange.from.toISOString())} — ${formatDate(dateRange.to.toISOString())}`
                        : formatDate(dateRange.from.toISOString())
                      : "Filter by date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarPicker
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              {dateRange?.from && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => setDateRange(undefined)}
                >
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {combined!.sessions.map((s, i) => (
              <div
                key={s.id}
                className="group rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      Session {i + 1}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {formatDate(s.date)}
                    </p>
                  </div>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove this session and recalculate attendance
                            percentages for all students.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => handleDeleteSession(s.id)}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground line-clamp-2">
                  {s.topic}
                </div>
                <div className="mt-3 text-xs">
                  <span className="font-semibold text-primary">
                    {s.attendees.length}
                  </span>{" "}
                  <span className="text-muted-foreground">attendees</span>
                </div>
              </div>
            ))}
            <div className="min-h-[140px]">
              <UploadDropzone onFiles={handleUpload} busy={busy} compact />
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="mt-10 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label>Min attendance:</label>
              <input
                type="range"
                min={0}
                max={100}
                step={10}
                value={minPct}
                onChange={(e) => setMinPct(Number(e.target.value))}
                className="w-32 accent-[color:var(--primary)]"
              />
              <span className="font-semibold text-foreground w-10">{minPct}%</span>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              Showing {filteredStudents.length} of {combined!.students.length} students
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="mt-4">
          {combined!.sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-16 text-center">
              <p className="text-muted-foreground">
                Upload a session file above to see the attendance table.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[image:var(--gradient-brand)] text-primary-foreground">
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-10 bg-primary text-left px-4 py-3 font-semibold min-w-[220px]"
                      >
                        Full Name
                      </th>
                      {combined!.sessions.map((s, i) => (
                        <th
                          key={s.id}
                          colSpan={2}
                          className="px-3 py-2 text-center font-semibold border-l border-white/20"
                        >
                          <div className="truncate">
                            {s.label || `Session ${i + 1}`}
                          </div>
                          <div className="text-[10px] font-normal opacity-80">
                            {formatDate(s.date)}
                          </div>
                        </th>
                      ))}
                      <th
                        rowSpan={2}
                        className="px-3 py-3 text-center font-semibold border-l border-white/20"
                      >
                        Present
                      </th>
                      <th
                        rowSpan={2}
                        className="px-3 py-3 text-center font-semibold border-l border-white/20"
                      >
                        Attendance
                      </th>
                    </tr>
                    <tr className="bg-primary/90 text-primary-foreground text-xs">
                      {combined!.sessions.map((s) => (
                        <Fragment key={s.id}>
                          <th className="px-3 py-1.5 text-center font-medium border-l border-white/20">
                            Join
                          </th>
                          <th className="px-3 py-1.5 text-center font-medium">
                            Leave
                          </th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((r, i) => (
                      <tr
                        key={r.name}
                        className={cn(
                          "border-t border-border transition-colors",
                          i % 2 === 1 ? "bg-accent/30" : "bg-card",
                          "hover:bg-accent/60",
                        )}
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-10 px-4 py-2.5 font-medium",
                            i % 2 === 1 ? "bg-accent/80" : "bg-card",
                          )}
                        >
                          {r.name}
                        </td>
                        {r.perSession.map((p, idx) => (
                          <Fragment key={idx}>
                            <td
                              className={cn(
                                "px-3 py-2 text-center tabular-nums border-l border-border/40",
                                !p.join && "text-muted-foreground",
                              )}
                            >
                              {p.join ? formatTime(p.join) : "—"}
                            </td>
                            <td
                              className={cn(
                                "px-3 py-2 text-center tabular-nums",
                                !p.leave && "text-muted-foreground",
                              )}
                            >
                              {p.leave ? formatTime(p.leave) : "—"}
                            </td>
                          </Fragment>
                        ))}
                        <td className="px-3 py-2 text-center font-semibold border-l border-border/40">
                          {r.attended}
                        </td>
                        <td className="px-3 py-2 text-center border-l border-border/40">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              r.attendancePct >= 80
                                ? "bg-success/15 text-success"
                                : r.attendancePct >= 50
                                  ? "bg-warning/15 text-warning"
                                  : "bg-destructive/15 text-destructive",
                            )}
                          >
                            {r.attendancePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td
                          colSpan={1 + combined!.sessions.length * 2 + 2}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          No students match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "brand" | "success" | "warn" | "danger";
}) {
  const colors = {
    default: "text-foreground",
    brand: "text-primary",
    success: "text-success",
    warn: "text-warning",
    danger: "text-destructive",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold", colors[tone])}>{value}</p>
    </div>
  );
}

