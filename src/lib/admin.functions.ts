import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesRes, rolesRes, authRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email, phone, department, created_at, is_active")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }

    const lastSignInByUser = new Map<string, string | null>();
    const bannedByUser = new Map<string, boolean>();
    for (const u of authRes.data?.users ?? []) {
      lastSignInByUser.set(u.id, u.last_sign_in_at ?? null);
      const bu = (u as { banned_until?: string | null }).banned_until ?? null;
      bannedByUser.set(u.id, !!bu && new Date(bu).getTime() > Date.now());
    }

    return (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone,
      department: p.department,
      created_at: p.created_at,
      roles: rolesByUser.get(p.id) ?? [],
      is_admin: (rolesByUser.get(p.id) ?? []).includes("admin"),
      last_sign_in_at: lastSignInByUser.get(p.id) ?? null,
      is_active:
        (p as { is_active?: boolean }).is_active !== false && !bannedByUser.get(p.id),
    }));
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You cannot remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [reportsRes, sessionsRes] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id, name, category, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("sessions")
        .select("id, label, topic, host_name, session_date, created_at, report_id")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (reportsRes.error) throw new Error(reportsRes.error.message);
    if (sessionsRes.error) throw new Error(sessionsRes.error.message);

    return {
      reports: reportsRes.data ?? [],
      sessions: sessionsRes.data ?? [],
    };
  });

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        makeAdmin: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.firstName, last_name: data.lastName },
    });
    if (created.error) throw new Error(created.error.message);
    const newId = created.data.user?.id;
    if (newId && data.makeAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { ok: true, userId: newId };
  });

export const updateUserDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        firstName: z.string().trim().optional(),
        lastName: z.string().trim().optional(),
        phone: z.string().trim().nullable().optional(),
        department: z.string().trim().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch.first_name = data.firstName;
    if (data.lastName !== undefined) patch.last_name = data.lastName;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.department !== undefined) patch.department = data.department || null;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ userId: z.string().uuid(), newPassword: z.string().min(8) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.active) {
      throw new Error("You cannot deactivate your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cast because ban_duration is not always in the exposed types.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { ban_duration: data.active ? "none" : "876000h" } as never,
    );
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.userId);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Extended dashboard stats
// ---------------------------------------------------------------------------

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersRes, rolesRes, reportsRes, sessionsRes, logsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("user_roles").select("role"),
      supabaseAdmin.from("reports").select("id, name, category, created_at"),
      supabaseAdmin
        .from("sessions")
        .select("id, report_id, session_date, created_at, source_filename, attendees"),
      supabaseAdmin.from("activity_logs").select("action"),
    ]);

    const roleRows = (rolesRes.data ?? []) as { role: string }[];
    const totalAdmins = roleRows.filter((r) => r.role === "admin").length;

    const reports = (reportsRes.data ?? []) as {
      id: string;
      name: string;
      category: string;
      created_at: string;
    }[];
    const sessions = (sessionsRes.data ?? []) as {
      id: string;
      report_id: string;
      session_date: string;
      created_at: string;
      source_filename: string;
      attendees: Array<{ name: string }> | null;
    }[];

    // Unique files across sessions.
    const files = new Set<string>();
    for (const s of sessions) if (s.source_filename) files.add(s.source_filename);

    // Unique students overall.
    const allStudents = new Set<string>();
    // Per-report student sets.
    const reportStudents = new Map<string, Set<string>>();
    const reportSessionCount = new Map<string, number>();
    const reportAttendedCount = new Map<string, Map<string, number>>(); // reportId -> studentName -> attendedCount
    for (const s of sessions) {
      reportSessionCount.set(s.report_id, (reportSessionCount.get(s.report_id) ?? 0) + 1);
      let set = reportStudents.get(s.report_id);
      if (!set) reportStudents.set(s.report_id, (set = new Set()));
      let attMap = reportAttendedCount.get(s.report_id);
      if (!attMap) reportAttendedCount.set(s.report_id, (attMap = new Map()));
      for (const a of s.attendees ?? []) {
        const n = (a?.name || "").trim();
        if (!n) continue;
        allStudents.add(n.toLowerCase());
        set.add(n.toLowerCase());
        attMap.set(n.toLowerCase(), (attMap.get(n.toLowerCase()) ?? 0) + 1);
      }
    }

    // Overall avg attendance = mean of each report's avg per-student attendance %.
    let sumPct = 0;
    let pctReports = 0;
    for (const [rid, sessionCount] of reportSessionCount.entries()) {
      if (sessionCount === 0) continue;
      const attMap = reportAttendedCount.get(rid);
      if (!attMap || attMap.size === 0) continue;
      let s = 0;
      for (const c of attMap.values()) s += (c / sessionCount) * 100;
      sumPct += s / attMap.size;
      pctReports += 1;
    }
    const avgAttendance = pctReports === 0 ? 0 : Math.round((sumPct / pctReports) * 10) / 10;

    // Monthly buckets — last 12 months (YYYY-MM).
    const months: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const monthLabel = (ym: string) => {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      });
    };

    const uploadsByMonth = new Map(months.map((m) => [m, 0]));
    for (const s of sessions) {
      const ym = (s.created_at ?? "").slice(0, 7);
      if (uploadsByMonth.has(ym)) uploadsByMonth.set(ym, (uploadsByMonth.get(ym) ?? 0) + 1);
    }
    const reportsByMonth = new Map(months.map((m) => [m, 0]));
    for (const r of reports) {
      const ym = (r.created_at ?? "").slice(0, 7);
      if (reportsByMonth.has(ym)) reportsByMonth.set(ym, (reportsByMonth.get(ym) ?? 0) + 1);
    }

    // Attendance trend per month = for reports whose session_date falls in that month,
    // average student % (approx: attended in that month vs sessions in that month for that report).
    const monthlyAttendance = new Map(months.map((m) => [m, { sum: 0, n: 0 }]));
    // Group sessions by (report_id, ym).
    const rSessions = new Map<string, Map<string, typeof sessions>>();
    for (const s of sessions) {
      const ym = (s.session_date ?? "").slice(0, 7);
      if (!monthlyAttendance.has(ym)) continue;
      let m = rSessions.get(s.report_id);
      if (!m) rSessions.set(s.report_id, (m = new Map()));
      const arr = m.get(ym) ?? [];
      arr.push(s);
      m.set(ym, arr);
    }
    for (const [, byMonth] of rSessions) {
      for (const [ym, list] of byMonth) {
        const total = list.length || 1;
        const attMap = new Map<string, number>();
        for (const s of list) {
          for (const a of s.attendees ?? []) {
            const n = (a?.name || "").trim().toLowerCase();
            if (!n) continue;
            attMap.set(n, (attMap.get(n) ?? 0) + 1);
          }
        }
        if (attMap.size === 0) continue;
        let pctSum = 0;
        for (const c of attMap.values()) pctSum += (c / total) * 100;
        const avg = pctSum / attMap.size;
        const bucket = monthlyAttendance.get(ym)!;
        bucket.sum += avg;
        bucket.n += 1;
      }
    }

    const catCounts = new Map<string, number>();
    for (const r of reports) catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);

    // Attendance distribution (buckets 0-25 / 26-50 / 51-75 / 76-100).
    const distribution = [
      { range: "0–25%", count: 0 },
      { range: "26–50%", count: 0 },
      { range: "51–75%", count: 0 },
      { range: "76–100%", count: 0 },
    ];
    for (const [rid, sessionCount] of reportSessionCount.entries()) {
      if (sessionCount === 0) continue;
      const attMap = reportAttendedCount.get(rid);
      if (!attMap) continue;
      for (const c of attMap.values()) {
        const pct = (c / sessionCount) * 100;
        const idx = pct <= 25 ? 0 : pct <= 50 ? 1 : pct <= 75 ? 2 : 3;
        distribution[idx].count += 1;
      }
    }

    const logsRows = (logsRes.data ?? []) as { action: string }[];
    const pdfDownloads = logsRows.filter((l) => l.action === "report.exported_pdf").length;
    const excelDownloads = logsRows.filter((l) => l.action === "report.exported_excel").length;

    return {
      totalUsers: usersRes.count ?? 0,
      totalAdmins,
      totalReports: reports.length,
      totalSessions: sessions.length,
      totalFiles: files.size,
      totalStudents: allStudents.size,
      avgAttendance,
      pdfDownloads,
      excelDownloads,
      reportsByCategory: (["MBA", "PDBA", "MMM", "MBA_PDBA"] as const).map((c) => ({
        category: c,
        count: catCounts.get(c) ?? 0,
      })),
      usersByRole: [
        { role: "admin", count: totalAdmins },
        { role: "user", count: (usersRes.count ?? 0) - totalAdmins },
      ],
      monthlyUploads: months.map((m) => ({
        month: monthLabel(m),
        Uploads: uploadsByMonth.get(m) ?? 0,
      })),
      monthlyReports: months.map((m) => ({
        month: monthLabel(m),
        Reports: reportsByMonth.get(m) ?? 0,
      })),
      attendanceTrends: months.map((m) => {
        const b = monthlyAttendance.get(m)!;
        return {
          month: monthLabel(m),
          Attendance: b.n === 0 ? 0 : Math.round((b.sum / b.n) * 10) / 10,
        };
      }),
      attendanceDistribution: distribution,
      recentReports: reports
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 6),
    };
  });

// ---------------------------------------------------------------------------
// Activity logs
// ---------------------------------------------------------------------------

export const listActivityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional().default(200),
        action: z.string().optional(),
        userId: z.string().uuid().optional(),
      })
      .optional()
      .default({}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 200);
    if (data?.action) q = q.eq("action", data.action);
    if (data?.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      user_id: string | null;
      user_email: string | null;
      user_name: string | null;
      user_role: string | null;
      action: string;
      resource_type: string | null;
      resource_id: string | null;
      details: Record<string, unknown>;
      created_at: string;
    }>;
  });