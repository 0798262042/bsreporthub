import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Eye, Ban, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listAllUsers, setApprovalStatus, type ApprovalStatus } from "@/lib/admin.functions";
import { logActivity } from "@/lib/activity";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserRow = Awaited<ReturnType<typeof listAllUsers>>[number];

const STATUS_META: Record<ApprovalStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pending Approval", cls: "bg-warning/20 text-foreground border border-warning/50", Icon: Clock },
  approved: { label: "Approved", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive", Icon: XCircle },
  suspended: { label: "Suspended", cls: "bg-muted text-muted-foreground", Icon: Ban },
};

export function StatusBadge({ status }: { status: ApprovalStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>
      <m.Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

const FILTERS: Array<{ value: ApprovalStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
  { value: "all", label: "All" },
];

export function usePendingCount() {
  const listFn = useServerFn(listAllUsers);
  const { data } = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  return (data ?? []).filter((u) => u.approval_status === "pending").length;
}

export function UserApprovals() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listAllUsers);
  const setFn = useServerFn(setApprovalStatus);
  const [filter, setFilter] = useState<ApprovalStatus | "all">("pending");
  const [details, setDetails] = useState<UserRow | null>(null);
  const [rejecting, setRejecting] = useState<UserRow | null>(null);
  const [reason, setReason] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users?.length ?? 0 };
    for (const u of users ?? []) c[u.approval_status] = (c[u.approval_status] ?? 0) + 1;
    return c;
  }, [users]);

  const rows = useMemo(() => {
    const list = (users ?? []).filter((u) => filter === "all" || u.approval_status === filter);
    // Pending first, oldest first so nobody waits too long.
    return list.sort((a, b) => {
      if (a.approval_status === "pending" && b.approval_status !== "pending") return -1;
      if (b.approval_status === "pending" && a.approval_status !== "pending") return 1;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [users, filter]);

  const mutate = useMutation({
    mutationFn: (v: { user: UserRow; status: "approved" | "rejected" | "suspended"; reason?: string }) =>
      setFn({ data: { userId: v.user.id, status: v.status, reason: v.reason } }),
    onSuccess: (_r, v) => {
      const msg = { approved: "Account approved.", rejected: "Registration rejected.", suspended: "Account suspended." }[v.status];
      toast.success(msg);
      void logActivity({
        action: `user.${v.status}`,
        resourceType: "user",
        resourceId: v.user.id,
        details: { email: v.user.email, ...(v.reason ? { reason: v.reason } : {}) },
      });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setRejecting(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const name = (u: UserRow) => `${u.first_name} ${u.last_name}`.trim() || "—";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">User Approval Management</h3>
          <p className="text-xs text-muted-foreground">
            New registrations must be approved before they can access Attendra.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label} ({counts[f.value] ?? 0})
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No accounts in this view.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Registration Date</TableHead>
                <TableHead>Account Status</TableHead>
                <TableHead>Assigned Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const isSelf = u.id === me?.id;
                const busy = mutate.isPending && mutate.variables?.user.id === u.id;
                return (
                  <TableRow key={u.id} className={u.approval_status === "pending" ? "bg-accent/40" : undefined}>
                    <TableCell className="font-medium">{name(u)}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell><StatusBadge status={u.approval_status} /></TableCell>
                    <TableCell className="text-muted-foreground">{u.is_admin ? "Administrator" : "User"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setDetails(u)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        {!isSelf && u.approval_status !== "approved" && (
                          <Button size="sm" disabled={busy} onClick={() => mutate.mutate({ user: u, status: "approved" })}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        )}
                        {!isSelf && u.approval_status === "pending" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(u)}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        )}
                        {!isSelf && u.approval_status === "approved" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate.mutate({ user: u, status: "suspended" })}>
                            <Ban className="h-4 w-4 mr-1" /> Suspend
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registration details</DialogTitle>
            <DialogDescription>Personal information — handle in line with POPIA.</DialogDescription>
          </DialogHeader>
          {details && (
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt><dd className="col-span-2">{name(details)}</dd>
              <dt className="text-muted-foreground">Email</dt><dd className="col-span-2 break-all">{details.email}</dd>
              <dt className="text-muted-foreground">Department</dt><dd className="col-span-2">{details.department || "—"}</dd>
              <dt className="text-muted-foreground">Registered</dt><dd className="col-span-2">{new Date(details.created_at).toLocaleString()}</dd>
              <dt className="text-muted-foreground">Status</dt><dd className="col-span-2"><StatusBadge status={details.approval_status} /></dd>
              <dt className="text-muted-foreground">Role</dt><dd className="col-span-2">{details.is_admin ? "Administrator" : "User"}</dd>
              {details.approved_at && (<><dt className="text-muted-foreground">Status updated</dt><dd className="col-span-2">{new Date(details.approved_at).toLocaleString()}</dd></>)}
              {details.rejection_reason && (<><dt className="text-muted-foreground">Rejection reason</dt><dd className="col-span-2">{details.rejection_reason}</dd></>)}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this registration?</DialogTitle>
            <DialogDescription>
              {rejecting?.email} will not be able to access Attendra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea id="reject-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={mutate.isPending}
              onClick={() => rejecting && mutate.mutate({ user: rejecting, status: "rejected", reason: reason.trim() || undefined })}
            >
              Reject registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
