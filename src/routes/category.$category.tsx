import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Trash2,
  Users,
  Plus,
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
import { useAuth } from "@/hooks/use-auth";
import {
  createReport,
  addSessions,
  deleteReport,
  findReportContainingSessions,
} from "@/lib/attendance/storage";
import { parseAttendanceFile } from "@/lib/attendance/parse";
import { toStoredSession, relabelSessions } from "@/lib/attendance/combine";
import type { Category } from "@/lib/attendance/types";
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_TOKENS } from "@/lib/attendance/types";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/category/$category")({
  component: CategoryPage,
});

function isCategory(c: string): c is Category {
  return (CATEGORIES as string[]).includes(c);
}

// Validate that every session in an upload matches the target category by topic.
// - MBA / PDBA / MMM: topic must contain that token AND none of the other two.
// - MBA_PDBA: topic must contain BOTH "MBA" and "PDBA".
function sessionsMatchCategory(
  stored: { topic: string }[],
  category: Category,
): { ok: boolean; badTopic?: string } {
  const required = CATEGORY_TOKENS[category];
  const forbidden =
    category === "MBA_PDBA"
      ? (["MMM"] as const)
      : (["MBA", "PDBA", "MMM"] as const).filter((t) => !required.includes(t));
  for (const s of stored) {
    const topic = (s.topic || "").toUpperCase();
    if (!required.every((t) => topic.includes(t)))
      return { ok: false, badTopic: s.topic };
    if (forbidden.some((t) => topic.includes(t)))
      return { ok: false, badTopic: s.topic };
  }
  return { ok: true };
}

function CategoryPage() {
  const { category: rawCategory } = Route.useParams();
  const navigate = useNavigate();
  const { reports } = useReports();
  const { isAdmin } = useAuth();

  const category: Category = isCategory(rawCategory) ? rawCategory : "MBA";
  const label = CATEGORY_LABELS[category];
  const list = useMemo(
    () => reports.filter((r) => r.category === category),
    [reports, category],
  );

  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const doCreate = async () => {
    const r = await createReport(name || `New ${label} report`, category);
    setName("");
    setOpen(false);
    if (r) {
      void logActivity({
        action: "report.created",
        resourceType: "report",
        resourceId: r.id,
        details: { name: r.name, category },
      });
      navigate({ to: "/report/$id", params: { id: r.id } });
    }
  };

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
      const match = sessionsMatchCategory(stored, category);
      if (!match.ok) {
        toast.error(`Not a ${label} file. Topic: "${match.badTopic}".`);
        return;
      }
      const dup = await findReportContainingSessions(stored);
      if (dup) {
        toast.error(`Already uploaded in "${dup.report.name}".`);
        navigate({ to: "/report/$id", params: { id: dup.report.id } });
        return;
      }
      const report = await createReport(
        files[0].name.replace(/\.(xlsx?|csv)$/i, "") || `New ${label} report`,
        category,
      );
      if (!report) {
        toast.error("Could not create report.");
        return;
      }
      const relabeled = relabelSessions(stored);
      await addSessions(report.id, relabeled);
      void logActivity({
        action: "report.created",
        resourceType: "report",
        resourceId: report.id,
        details: { name: report.name, category },
      });
      void logActivity({
        action: "spreadsheet.uploaded",
        resourceType: "report",
        resourceId: report.id,
        details: {
          filename: files.map((f) => f.name).join(", "),
          sessions: relabeled.length,
        },
      });
      toast.success(`Created ${label} report with ${relabeled.length} session(s).`);
      navigate({ to: "/report/$id", params: { id: report.id } });
    } catch (e) {
      console.error(e);
      toast.error("Could not parse that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 text-muted-foreground"
          onClick={() => navigate({ to: "/" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> All categories
        </Button>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">
              Category
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{label} Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {list.length} report{list.length === 1 ? "" : "s"} in this category.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[image:var(--gradient-brand)] text-white">
                <Plus className="mr-1 h-4 w-4" /> New {label} report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new {label} report</DialogTitle>
              </DialogHeader>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. ${label} HR Strategies — Q1`}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && doCreate()}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={doCreate}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
                <p className="text-muted-foreground">
                  No {label} reports yet. Drop a file on the right to get started.
                </p>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {list.map((r) => (
                  <li
                    key={r.id}
                    className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to="/report/$id"
                        params={{ id: r.id }}
                        className="text-left flex-1"
                      >
                        <p className="font-semibold text-foreground line-clamp-2">
                          {r.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Updated {new Date(r.updatedAt).toLocaleString()}
                        </p>
                      </Link>
                      {isAdmin && (
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
                              "{r.name}" and its sessions will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => {
                                deleteReport(r.id);
                                void logActivity({
                                  action: "report.deleted",
                                  resourceType: "report",
                                  resourceId: r.id,
                                  details: { name: r.name, category: r.category },
                                });
                                toast.success("Report deleted");
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      )}
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
                    <Link
                      to="/report/$id"
                      params={{ id: r.id }}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:gap-2 transition-all"
                    >
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <UploadDropzone onFiles={handleUpload} busy={busy} />
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Only {label} sessions accepted here. Topic must contain
              "{CATEGORY_TOKENS[category].join(" + ")}".
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}