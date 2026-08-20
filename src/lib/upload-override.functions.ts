import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OverrideInput = {
  reportId: string;
  filename: string;
  detectedTopic: string;
  selectedTopic: string;
  sessions: number;
};

/**
 * Server-side gate for the admin upload override.
 *
 * The client must call this BEFORE persisting sessions that failed the
 * topic/lecturer/module validation. Non-admins are rejected here, so hiding
 * the switch in the UI is not the only protection. On success the override is
 * written to the audit log with the service role (immutable audit trail).
 */
export const authorizeAdminOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OverrideInput) => {
    if (!input?.reportId) throw new Error("reportId is required");
    return {
      reportId: String(input.reportId),
      filename: String(input.filename ?? "").slice(0, 500),
      detectedTopic: String(input.detectedTopic ?? "").slice(0, 500),
      selectedTopic: String(input.selectedTopic ?? "").slice(0, 500),
      sessions: Number(input.sessions ?? 0),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error || !isAdmin) {
      throw new Error(
        "Only administrators can override upload validation for this report.",
      );
    }

    const claims = context.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.["email"] === "string" ? (claims["email"] as string) : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_logs").insert({
      user_id: context.userId,
      user_email: email,
      user_role: "admin",
      action: "spreadsheet.override_upload",
      resource_type: "report",
      resource_id: data.reportId,
      details: {
        filename: data.filename,
        detectedTopic: data.detectedTopic,
        selectedTopic: data.selectedTopic,
        sessions: data.sessions,
        adminOverride: true,
        result: "allowed",
      } as never,
    });

    return { ok: true as const };
  });
