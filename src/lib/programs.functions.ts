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

const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9_]+$/, "Use capital letters, numbers and underscores only");

export const createProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        code: codeSchema,
        label: z.string().trim().min(1).max(80),
        blurb: z.string().trim().max(200).optional().default(""),
        tokens: z.array(z.string().trim().min(1).max(40)).min(1).max(6),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin
      .from("programs")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("programs").insert({
      code: data.code,
      label: data.label,
      blurb: data.blurb ?? "",
      tokens: data.tokens.map((t) => t.toUpperCase()),
      sort_order: ((maxRow as { sort_order?: number } | null)?.sort_order ?? 0) + 1,
    });
    if (error) {
      if (error.code === "23505" || /duplicate/i.test(error.message))
        throw new Error("A programme with that code already exists.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(80).optional(),
        blurb: z.string().trim().max(200).optional(),
        tokens: z.array(z.string().trim().min(1).max(40)).min(1).max(6).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.blurb !== undefined) patch.blurb = data.blurb;
    if (data.tokens !== undefined) patch.tokens = data.tokens.map((t) => t.toUpperCase());
    const { error } = await supabaseAdmin
      .from("programs")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prog, error: readErr } = await supabaseAdmin
      .from("programs")
      .select("code")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!prog) throw new Error("Programme not found.");
    const code = (prog as { code: string }).code;
    const { count } = await supabaseAdmin
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("category", code);
    if ((count ?? 0) > 0)
      throw new Error(
        `Cannot delete: ${count} report(s) still use this programme.`,
      );
    const { error } = await supabaseAdmin.from("programs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("programs")
      .select("id, code, label, blurb, tokens, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProgramRow[];
  });

export type ProgramRow = {
  id: string;
  code: string;
  label: string;
  blurb: string;
  tokens: string[];
  sort_order: number;
};
