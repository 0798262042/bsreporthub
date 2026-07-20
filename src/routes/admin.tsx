import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  FileSpreadsheet,
  Users,
  Layers,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Search,
  Trash2,
  Activity,
  UserCog,
  Percent,
  GraduationCap,
  FileDown,
  Ban,
  KeyRound,
  UserPlus,
  Pencil,
  ScrollText,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { BrandHeader } from "@/components/attendance/BrandHeader";
import { CATEGORY_LABELS, type Category } from "@/lib/attendance/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  listAllUsers,
  setUserAdmin,
  deleteUserAccount,
  createUserAccount,
  updateUserDetails,
  resetUserPassword,
  setUserActive,
  getDashboardStats,
  listActivityLogs,
} from "@/lib/admin.functions";
import { ACTIVITY_LABELS } from "@/lib/activity";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
});

type UserRow = Awaited<ReturnType<typeof listAllUsers>>[number];

function AdminDashboard() {
  const { isAdmin, loading, session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overview" | "users" | "activity" | "logs">(
    "overview",
  );

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (!isAdmin) navigate({ to: "/", replace: true });
  }, [loading, session, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Administrator portal
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              System-wide overview, user management and audit trail.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Go to reports <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-8">
          <TabsList>
            <TabsTrigger value="overview">
              <Layers className="h-4 w-4 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger value="users">
              <UserCog className="h-4 w-4 mr-2" /> User management
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" /> Recent activity
            </TabsTrigger>
            <TabsTrigger value="logs">
              <ScrollText className="h-4 w-4 mr-2" /> Activity logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
          <TabsContent value="activity" className="mt-6">
            <RecentActivity />
          </TabsContent>
          <TabsContent value="logs" className="mt-6">
            <ActivityLogs />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  const statsFn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => statsFn(),
  });

  if (isLoading || !data) {
    return (
      <div className="mt-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <section className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Registered users"
          value={data.totalUsers}
          sub={`${data.totalAdmins} admin${data.totalAdmins === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          label="Attendance sessions"
          value={data.totalSessions}
        />
        <StatCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="Uploaded files"
          value={data.totalFiles}
        />
        <StatCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="Reports generated"
          value={data.totalReports}
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Total students"
          value={data.totalStudents}
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          label="Average attendance"
          value={`${data.avgAttendance}%`}
        />
        <StatCard
          icon={<FileDown className="h-5 w-5" />}
          label="PDF downloads"
          value={data.pdfDownloads}
        />
        <StatCard
          icon={<FileDown className="h-5 w-5" />}
          label="Excel downloads"
          value={data.excelDownloads}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Reports by category" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data.reportsByCategory.map((r) => ({
                name: CATEGORY_LABELS[r.category as Category],
                Reports: r.count,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Reports" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Users by role">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.usersByRole.map((r) => ({
                  name: r.role === "admin" ? "Admins" : "Users",
                  value: r.count,
                }))}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
              >
                {data.usersByRole.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                ))}
              </Pie>
              <Legend />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </section>
    </>
  );
}

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[image:var(--gradient-brand)] text-white">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

function UserManagement() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);

  const listFn = useServerFn(listAllUsers);
  const setAdminFn = useServerFn(setUserAdmin);
  const deleteFn = useServerFn(deleteUserAccount);
  const setActiveFn = useServerFn(setUserActive);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const toggleAdmin = useMutation({
    mutationFn: (vars: { userId: string; makeAdmin: boolean }) =>
      setAdminFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.makeAdmin ? "Granted admin role." : "Removed admin role.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (vars: { userId: string; active: boolean }) =>
      setActiveFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(vars.active ? "Account activated." : "Account deactivated.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const name = `${u.first_name} ${u.last_name}`.toLowerCase();
      const matches =
        !q ||
        name.includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q);
      const statusOk =
        statusFilter === "all" ||
        (statusFilter === "active" ? u.is_active : !u.is_active);
      const roleOk =
        roleFilter === "all" ||
        (roleFilter === "admin" ? u.is_admin : !u.is_admin);
      return matches && statusOk && roleOk;
    });
  }, [users, search, statusFilter, roleFilter]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">All accounts</h3>
          <p className="text-xs text-muted-foreground">
            {users?.length ?? 0} total. {filtered.length} shown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-72"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="user">Users</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" /> New user
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {(u.first_name || u.last_name)
                        ? `${u.first_name} ${u.last_name}`.trim()
                        : "—"}
                      {isSelf && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          you
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.department || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          <Ban className="h-3 w-3" /> Suspended
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={u.is_admin}
                        disabled={isSelf || toggleAdmin.isPending}
                        onCheckedChange={(checked) =>
                          toggleAdmin.mutate({ userId: u.id, makeAdmin: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Filter className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(u)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetUser(u)}>
                            <KeyRound className="h-4 w-4 mr-2" /> Reset password
                          </DropdownMenuItem>
                          {u.is_active ? (
                            <DropdownMenuItem
                              disabled={isSelf}
                              onClick={() =>
                                toggleActive.mutate({ userId: u.id, active: false })
                              }
                            >
                              <Ban className="h-4 w-4 mr-2" /> Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                toggleActive.mutate({ userId: u.id, active: true })
                              }
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Activate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                disabled={isSelf}
                                className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete user
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes {u.email} and their profile. This
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeUser.mutate(u.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onDone={invalidateAll} />
      <EditUserDialog user={editUser} onClose={() => setEditUser(null)} onDone={invalidateAll} />
      <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const createFn = useServerFn(createUserAccount);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      createFn({ data: { firstName, lastName, email, password, makeAdmin } }),
    onSuccess: () => {
      toast.success("User created.");
      onDone();
      onOpenChange(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setMakeAdmin(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>
            The account is confirmed immediately and the user can sign in with the password
            you set here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary password (min 8 chars)</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={makeAdmin} onCheckedChange={setMakeAdmin} />
            Grant administrator role
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: UserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const updateFn = useServerFn(updateUserDetails);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      setPhone(user.phone ?? "");
      setDepartment(user.department ?? "");
    }
  }, [user]);

  const mut = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user");
      return updateFn({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone: phone || null,
          department: department || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("User updated.");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user?.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserRow | null;
  onClose: () => void;
}) {
  const resetFn = useServerFn(resetUserPassword);
  const [pw, setPw] = useState("");
  const mut = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("No user");
      return resetFn({ data: { userId: user.id, newPassword: pw } });
    },
    onSuccess: () => {
      toast.success("Password reset.");
      setPw("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {user?.email}</DialogTitle>
          <DialogDescription>
            Set a new password (min 8 characters). The user will be signed out of active
            sessions.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || pw.length < 8}>
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Recent activity (reports/sessions) — legacy tab
// ---------------------------------------------------------------------------

function RecentActivity() {
  const statsFn = useServerFn(getDashboardStats);
  const logsFn = useServerFn(listActivityLogs);
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => statsFn(),
  });
  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-recent-logs"],
    queryFn: () => logsFn({ data: { limit: 15 } }),
  });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Latest reports created">
        {stats.recentReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stats.recentReports.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <Link
                    to="/report/$id"
                    params={{ id: r.id }}
                    className="block truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[r.category as Category]} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Latest user actions">
        {(logs?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {logs!.map((l) => (
              <li key={l.id} className="py-3">
                <p className="text-sm font-medium text-foreground">
                  {ACTIVITY_LABELS[l.action] ?? l.action}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.user_email ?? "System"} · {new Date(l.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity logs (full audit)
// ---------------------------------------------------------------------------

function ActivityLogs() {
  const logsFn = useServerFn(listActivityLogs);
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", action],
    queryFn: () =>
      logsFn({
        data: { limit: 300, action: action === "all" ? undefined : action },
      }),
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.user_email, r.user_name, r.action, r.resource_type, r.resource_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Audit trail</h3>
          <p className="text-xs text-muted-foreground">
            Every user action across the system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user, resource"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-72"
            />
          </div>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filter action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No entries.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const d = new Date(r.created_at);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {r.user_name || r.user_email || "—"}
                      </div>
                      {r.user_email && r.user_name && (
                        <div className="text-xs text-muted-foreground">{r.user_email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {r.user_role ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>{ACTIVITY_LABELS[r.action] ?? r.action}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.resource_type
                        ? `${r.resource_type}${r.resource_id ? ` · ${r.resource_id.slice(0, 8)}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {d.toLocaleTimeString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}