import { supabase } from "@/integrations/supabase/client";

export type ActivityAction =
  | "user.login"
  | "user.logout"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.password_reset"
  | "user.activated"
  | "user.deactivated"
  | "user.role_granted"
  | "user.role_revoked"
  | "spreadsheet.uploaded"
  | "report.created"
  | "report.renamed"
  | "report.deleted"
  | "report.exported_pdf"
  | "report.exported_excel"
  | "session.renamed"
  | "session.deleted";

export const ACTIVITY_LABELS: Record<string, string> = {
  "user.login": "User signed in",
  "user.logout": "User signed out",
  "user.created": "User account created",
  "user.updated": "User details updated",
  "user.deleted": "User deleted",
  "user.password_reset": "Password reset",
  "user.activated": "Account activated",
  "user.deactivated": "Account deactivated",
  "user.role_granted": "Administrator role granted",
  "user.role_revoked": "Administrator role revoked",
  "spreadsheet.uploaded": "Spreadsheet uploaded",
  "report.created": "Report created",
  "report.renamed": "Report renamed",
  "report.deleted": "Report deleted",
  "report.exported_pdf": "Report exported to PDF",
  "report.exported_excel": "Report exported to Excel",
  "session.renamed": "Session renamed",
  "session.deleted": "Session deleted",
};

type LogInput = {
  action: ActivityAction | string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
};

export async function logActivity(input: LogInput) {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    // Best-effort enrichment for the audit row.
    let name: string | null = null;
    let role: string | null = null;
    try {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (profile) {
        const fn = (profile.first_name ?? "").trim();
        const ln = (profile.last_name ?? "").trim();
        name = `${fn} ${ln}`.trim() || null;
      }
      const rs = (roles ?? []).map((r) => r.role as string);
      role = rs.includes("admin") ? "admin" : rs[0] ?? "user";
    } catch {
      /* ignore */
    }

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name: name,
      user_role: role,
      action: input.action,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      details: input.details ?? {},
    });
  } catch (e) {
    console.warn("activity log failed", e);
  }
}