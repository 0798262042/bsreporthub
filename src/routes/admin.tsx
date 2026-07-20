import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { FileSpreadsheet, Users, Layers, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BrandHeader } from "@/components/attendance/BrandHeader";
import { CATEGORY_LABELS, type Category } from "@/lib/attendance/types";

export const Route = createFileRoute("/admin")({
  component: AdminDashboard,
});

type Stats = {
  totalUsers: number;
  totalAdmins: number;
  totalReports: number;
  totalSessions: number;
  reportsByCategory: { category: Category; count: number }[];
  usersByRole: { role: string; count: number }[];
  recentReports: {
    id: string;
    name: string;
    category: Category;
    created_at: string;
  }[];
};

async function fetchStats(): Promise<Stats> {
  const [usersRes, rolesRes, reportsRes, sessionsRes, recentRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("user_roles").select("role"),
    supabase.from("reports").select("category"),
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select("id, name, category, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const roleRows = (rolesRes.data ?? []) as { role: string }[];
  const roleCounts = new Map<string, number>();
  for (const r of roleRows) roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + 1);

  const reportRows = (reportsRes.data ?? []) as { category: Category }[];
  const catCounts = new Map<Category, number>();
  for (const r of reportRows) catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);

  return {
    totalUsers: usersRes.count ?? 0,
    totalAdmins: roleCounts.get("admin") ?? 0,
    totalReports: reportRows.length,
    totalSessions: sessionsRes.count ?? 0,
    reportsByCategory: (["MBA", "PDBA", "MMM", "MBA_PDBA"] as Category[]).map((c) => ({
      category: c,
      count: catCounts.get(c) ?? 0,
    })),
    usersByRole: Array.from(roleCounts.entries()).map(([role, count]) => ({ role, count })),
    recentReports: (recentRes.data ?? []) as Stats["recentReports"],
  };
}

function AdminDashboard() {
  const { isAdmin, loading, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth", replace: true });
    else if (!isAdmin) navigate({ to: "/", replace: true });
  }, [loading, session, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchStats,
    enabled: isAdmin,
  });

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
              Overview of users, reports and attendance activity.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Go to reports <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading || !data ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="Total users"
                value={data.totalUsers}
                sub={`${data.totalAdmins} admin${data.totalAdmins === 1 ? "" : "s"}`}
              />
              <StatCard
                icon={<FileSpreadsheet className="h-5 w-5" />}
                label="Total reports"
                value={data.totalReports}
              />
              <StatCard
                icon={<Layers className="h-5 w-5" />}
                label="Total sessions"
                value={data.totalSessions}
              />
              <StatCard
                icon={<ShieldCheck className="h-5 w-5" />}
                label="Administrators"
                value={data.totalAdmins}
              />
            </section>

            <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Reports by category" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.reportsByCategory.map((r) => ({
                      name: CATEGORY_LABELS[r.category],
                      Reports: r.count,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="Reports" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Users by role">
                <ResponsiveContainer width="100%" height={280}>
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
                        <Cell
                          key={i}
                          fill={i === 0 ? "hsl(var(--primary))" : "hsl(var(--accent-foreground))"}
                        />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Panel>
            </section>

            <section className="mt-8">
              <Panel title="Recent reports">
                {data.recentReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentReports.map((r) => (
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
                            {CATEGORY_LABELS[r.category]} ·{" "}
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          to="/report/$id"
                          params={{ id: r.id }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

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