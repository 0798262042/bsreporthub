import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Users,
  Calendar,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useReports } from "@/hooks/use-reports";
import {
  createReport,
  addSessions,
  deleteReport,
} from "@/lib/attendance/storage";
import { parseAttendanceFile } from "@/lib/attendance/parse";
import { toStoredSession, relabelSessions } from "@/lib/attendance/combine";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { reports } = useReports();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doCreate = () => {
    const r = createReport(name || "Untitled Report");
    setName("");
    setOpen(false);
    navigate({ to: "/report/$id", params: { id: r.id } });
  };

  const handleQuickUpload = async (files: File[]) => {
    setBusy(true);
    try {
      const report = createReport(
        files[0].name.replace(/\.(xlsx?|csv)$/i, "") || "Untitled Report",
      );
      const stored = [];
      for (const f of files) {
        const parsed = await parseAttendanceFile(f);
        parsed.warnings.forEach((w) => toast.warning(w));
        for (const s of parsed.sessions) stored.push(toStoredSession(s));
      }
      if (stored.length === 0) {
        toast.error("No attendance data found in the uploaded file(s).");
        deleteReport(report.id);
        return;
      }
      const relabeled = relabelSessions(stored);
      addSessions(report.id, relabeled);
      toast.success(`Created report with ${relabeled.length} session(s).`);
      navigate({ to: "/report/$id", params: { id: report.id } });
    } catch (e) {
      console.error(e);
      toast.error("Could not parse that file. Is it a Zoom attendance export?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              For Faculty & Administration
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Turn Zoom attendance chaos into a{" "}
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">
                polished report
              </span>{" "}
              in seconds.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Upload one Zoom export per session. We clean duplicates, normalize names,
              calculate attendance percentages, and export beautiful Excel & PDF reports.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)] hover:opacity-95"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    New Report
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a new attendance report</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. PDBA MBA Management Accounting — Q1"
                      onKeyDown={(e) => e.key === "Enter" && doCreate()}
                      autoFocus
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={doCreate}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  const el = document.getElementById("quick-upload");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Quick upload
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              <Stat kpi="Auto" label="Session detection" />
              <Stat kpi="0" label="Setup required" />
              <Stat kpi="Excel + PDF" label="Exports" />
            </div>
          </div>

          <div id="quick-upload">
            <UploadDropzone onFiles={handleQuickUpload} busy={busy} />
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Files are processed in your browser — no data leaves your device.
            </p>
          </div>
        </section>

        <section className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Recent reports
            </h2>
            <p className="text-sm text-muted-foreground">
              {reports.length} saved locally
            </p>
          </div>

          {reports.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
              <p className="text-muted-foreground">
                No reports yet. Create one or drop a file above to get started.
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() =>
                        navigate({ to: "/report/$id", params: { id: r.id } })
                      }
                      className="text-left flex-1"
                    >
                      <p className="font-semibold text-foreground line-clamp-2">
                        {r.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Updated {new Date(r.updatedAt).toLocaleString()}
                      </p>
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete report?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{r.name}" and its uploaded sessions will be permanently
                            removed from this browser.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => {
                              deleteReport(r.id);
                              toast.success("Report deleted");
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {r.sessions.length} session{r.sessions.length === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {new Set(
                        r.sessions.flatMap((s) => s.attendees.map((a) => a.name)),
                      ).size}{" "}
                      students
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      navigate({ to: "/report/$id", params: { id: r.id } })
                    }
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:gap-2 transition-all"
                  >
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ kpi, label }: { kpi: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-bold text-primary">{kpi}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
