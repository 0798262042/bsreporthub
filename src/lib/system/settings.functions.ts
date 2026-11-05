import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  defaults,
  parseSettings,
  settingsSchema,
  mediaPaths,
  validateImageBytes,
} from "./settings";
import type { Database } from "@/integrations/supabase/types";

export const getPublishedSettings = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) return defaults;
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client
    .from("site_settings")
    .select("content")
    .eq("id", "website")
    .maybeSingle();
  if (error) throw new Error("Could not load the latest website settings. Please try again.");
  return parseSettings(data?.content);
});
export const getManagedSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: admin }, { data: approved }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("is_approved", { _user_id: context.userId }),
    ]);
    if (!admin || !approved) throw new Error("Administrator access required.");
    const [draft, published, versions] = await Promise.all([
      context.supabase.from("site_drafts").select("*").eq("id", "website").maybeSingle(),
      context.supabase.from("site_settings").select("*").eq("id", "website").maybeSingle(),
      context.supabase
        .from("site_versions")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(30),
    ]);
    if (draft.error || published.error || versions.error)
      throw new Error("Could not load website settings.");
    return {
      draft: parseSettings(draft.data?.content ?? published.data?.content),
      published: parseSettings(published.data?.content),
      revision: draft.data?.revision ?? 0,
      versions: (versions.data ?? []).map((v) => ({ ...v, content: parseSettings(v.content) })),
    };
  });
export const saveManagedSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        action: z.enum(["save", "publish", "restore"]),
        content: settingsSchema,
        revision: z.number().int().nonnegative(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const [{ data: admin }, { data: approved }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("is_approved", { _user_id: context.userId }),
    ]);
    if (!admin || !approved) throw new Error("Administrator access required.");
    for (const path of new Set(mediaPaths(data.content))) {
      const { data: file, error } = await context.supabase.storage
        .from("site-media")
        .download(path);
      if (
        error ||
        !file ||
        !validateImageBytes(
          new Uint8Array(await file.slice(0, 12).arrayBuffer()),
          path.split(".").pop() ?? "",
          file.size,
        )
      )
        throw new Error("Upload a valid PNG, JPEG, WebP or ICO image up to 5 MB before saving.");
    }
    const { data: revision, error } = await context.supabase.rpc("manage_site_content", {
      _action: data.action,
      _content: data.content,
      _revision: data.revision,
    });
    if (error)
      throw new Error(
        error.message.includes("another administrator")
          ? "Settings changed by another administrator. Reload before saving."
          : "Could not save website settings. Administrator access is required.",
      );
    return { revision, content: data.content };
  });
