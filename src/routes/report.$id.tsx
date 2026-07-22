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
  EyeOff,
  Eye,
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
import { useAuth } from "@/hooks/use-auth";
import {
  addSessions,
  removeSession,
  renameReport,
  findDuplicateSessions,
  setHiddenNames,
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
import { logActivity } from "@/lib/activity";
import type { DateRange } from "react-day-picker";

// Extract a normalized "lecturer" signature from a Zoom session topic.
// Topics look like "BS-18 May 2026-MMM Research – Dr Mashayamombe" — the
// lecturer name is the last chunk after an en/em dash or " - ".
function lecturerKey(topic: string): string {
  const t = (topic || "").trim();
  if (!t) return "";
  const parts = t.split(/\s*[–—]\s*|\s-\s/);
  const last = (parts[parts.length - 1] || t).toLowerCase();
  return last.replace(/\s+/g, " ").trim();
}

// Extract a normalized "module" signature — the middle chunk(s) of a topic
// like "BS-23 June 2026 - PDBA AND MBA HR STRATEGIES ... - PROF WERNER".
// Falls back to the whole topic when there aren't enough dash-separated parts.
function moduleKey(topic: string): string {
  const t = (topic || "").trim();
  if (!t) return "";
  const parts = t
    .split(/\s*[–—]\s*|\s-\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  let mid: string;
  if (parts.length >= 3) mid = parts.slice(1, -1).join(" ");
  else if (parts.length === 2) mid = parts[0];
  else mid = parts[0] ?? t;
  // Strip a leading "BS-<date>" style prefix if it slipped through.
  mid = mid.replace(/^bs[\s-]*\d.*?\d{4}\s*[-–—:]?\s*/i, "").trim();
  return mid.toLowerCase().replace(/\s+/g, " ").trim();
}

function prettyLecturer(topic: string): string {
  const t = (topic || "").trim();
  const parts = t.split(/\s*[–—]\s*|\s-\s/).map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || t;
}
function prettyModule(topic: string): string {
  const t = (topic || "").trim();
  const parts = t.split(/\s*[–—]\s*|\s-\s/).map((p) => p.trim()).filter(Boolean);
  let mod: string;
  if (parts.length >= 3) mod = parts.slice(1, -1).join(" — ");
  else if (parts.length === 2) mod = parts[0];
  else mod = t;
  // Strip time ranges like "17:30-20:30" or "5:00 PM - 8:00 PM".
  mod = mod
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm)?\s*[-–—to]+\s*\d{1,2}[:.]\d{2}\s*(?:am|pm)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–—]+$/g, "")
    .trim();
  return mod;
}

function prettyModuleAndLecturer(topic: string): string {
  const mod = prettyModule(topic);
  const lec = prettyLecturer(topic);
  if (mod && lec && mod.toLowerCase() !== lec.toLowerCase()) return `${mod} - ${lec}`;
  return mod || lec || topic;
}

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
  const { isAdmin } = useAuth();

  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [minPct, setMinPct] = useState(0);
  const [renamingReport, setRenamingReport] = useState(false);
  const [reportNameDraft, setReportNameDraft] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showHidden, setShowHidden] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const hiddenSet = useMemo(
    () => new Set((report?.hiddenNames ?? []).map((n) => n.toLowerCase())),
    [report],
  );

  const fullCombined = useMemo(() => {
    if (!report) return null;
    return combineReport(report.sessions);
  }, [report]);

  // Apply date-range filter on top of the combined report.
  const combined = useMemo(() => {
    if (!fullCombined) return null;
    const applyHidden = (students: typeof fullCombined.students) =>
      showHidden
        ? students
        : students.filter((s) => !hiddenSet.has(s.name.toLowerCase()));
    if (!dateRange?.from && !dateRange?.to)
      return { ...fullCombined, students: applyHidden(fullCombined.students) };
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
    return { sessions: kept, students: applyHidden(students) };
  }, [fullCombined, dateRange, hiddenSet, showHidden]);

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
        <main className="mx-auto w-full max-w-[1600px] px-4 py-16 text-center sm:px-6 lg:px-8">
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
        toast.error("Unable to import attendance.");
        return;
      }
      // Lecturer lock — every session in a report must be for the same lecturer.
      const existingLecturers = new Set(
        (report?.sessions ?? [])
          .map((s) => lecturerKey(s.topic))
          .filter(Boolean),
      );
      if (existingLecturers.size > 0) {
        const expected = [...existingLecturers][0];
        const mismatch = stored.find((s) => {
          const k = lecturerKey(s.topic);
          return k && k !== expected;
        });
        if (mismatch) {
          toast.error(
            `This attendance file belongs to ${prettyModuleAndLecturer(mismatch.topic)} and cannot be uploaded in this section report.`,
          );
          return;
        }
      }
      // Module lock — every session in a report must be for the same module.
      const existingModules = new Set(
        (report?.sessions ?? [])
          .map((s) => moduleKey(s.topic))
          .filter(Boolean),
      );
      if (existingModules.size > 0) {
        const expectedModule = [...existingModules][0];
        const mismatch = stored.find((s) => {
          const k = moduleKey(s.topic);
          return k && k !== expectedModule;
        });
        if (mismatch) {
          toast.error(
            `This attendance file belongs to ${prettyModuleAndLecturer(mismatch.topic)} and cannot be uploaded in this section report.`,
          );
          return;
        }
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
      void logActivity({
        action: "spreadsheet.uploaded",
        resourceType: "report",
        resourceId: id,
        details: {
          filename: files.map((f) => f.name).join(", "),
          sessions: fresh.length,
        },
      });
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
    void logActivity({
      action: "session.deleted",
      resourceType: "session",
      resourceId: sessionId,
      details: { reportId: id },
    });
    toast.success("Session removed");
  };

  const toggleHide = (name: string) => {
    if (!report) return;
    const current = report.hiddenNames ?? [];
    const isHidden = current.some((n) => n.toLowerCase() === name.toLowerCase());
    const next = isHidden
      ? current.filter((n) => n.toLowerCase() !== name.toLowerCase())
      : [...current, name];
    setHiddenNames(id, next);
    toast.success(isHidden ? `Restored ${name}` : `Hidden ${name}`);
  };

  const dateRangeLabel = reportDateRange(report.sessions);

  const handleExportExcel = () => {
    if (!combined || combined.students.length === 0) return;
    try {
      const topic = report.sessions[0]?.topic ?? report.name;
      const filenameBase = prettyModuleAndLecturer(topic);
      exportReportExcel(report.name, combined.sessions, combined.students, filenameBase);
      void logActivity({
        action: "report.exported_excel",
        resourceType: "report",
        resourceId: id,
        details: { name: report.name },
      });
      toast.success("Excel export started.");
    } catch (e) {
      console.error(e);
      toast.error("Could not export Excel.");
    }
  };

  const handleExportPdf = async () => {
    if (!combined || combined.students.length === 0 || exportingPdf) return;
    setExportingPdf(true);
    try {
      const topic = report.sessions[0]?.topic ?? report.name;
      const filenameBase = prettyModuleAndLecturer(topic);
      await exportReportPdf(report.name, combined.sessions, combined.students, filenameBase);
      void logActivity({
        action: "report.exported_pdf",
        resourceType: "report",
        resourceId: id,
        details: { name: report.name },
      });
      toast.success("PDF export started.");
    } catch (e) {
      console.error(e);
      toast.error("Could not export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
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
                      void logActivity({
                        action: "report.renamed",
                        resourceType: "report",
                        resourceId: id,
                        details: { newName: reportNameDraft },
                      });
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
                    void logActivity({
                      action: "report.renamed",
                      resourceType: "report",
                      resourceId: id,
                      details: { newName: reportNameDraft },
                    });
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
              onClick={handleExportExcel}
            >
              <Download className="h-4 w-4 mr-1.5" /> Excel
            </Button>
            <Button
              className="bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]"
              disabled={combined!.students.length === 0 || exportingPdf}
              onClick={handleExportPdf}
            >
              <FileText className="h-4 w-4 mr-1.5" /> {exportingPdf ? "Preparing…" : "PDF"}
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
                  {isAdmin && (
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
                  )}
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
            {(report.hiddenNames?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHidden((v) => !v)}
              >
                {showHidden ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1.5" /> Hide{" "}
                    {report.hiddenNames.length} hidden
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1.5" /> Show{" "}
                    {report.hiddenNames.length} hidden
                  </>
                )}
              </Button>
            )}
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
                          "group border-t border-border transition-colors",
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
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                hiddenSet.has(r.name.toLowerCase()) &&
                                  "text-muted-foreground italic",
                              )}
                            >
                              {r.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleHide(r.name)}
                              title={
                                hiddenSet.has(r.name.toLowerCase())
                                  ? "Restore row"
                                  : "Hide this row (e.g. lecturer)"
                              }
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            >
                              {hiddenSet.has(r.name.toLowerCase()) ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
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

