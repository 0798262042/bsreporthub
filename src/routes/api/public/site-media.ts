import { createFileRoute } from "@tanstack/react-router";
import { mediaPaths, parseSettings } from "@/lib/system/settings";
export const Route = createFileRoute("/api/public/site-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path") ?? "";
        if (!/^[a-f0-9-]+\.(png|jpg|webp|ico)$/.test(path))
          return new Response("Not found", { status: 404 });
        // Only media explicitly referenced by published settings can be served publicly.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("site_settings")
          .select("content")
          .eq("id", "website")
          .maybeSingle();
        if (error || !mediaPaths(parseSettings(data?.content)).includes(path))
          return new Response("Not found", { status: 404 });
        // Validate current publication on every revalidation, even when bytes are cached.
        const headers = {
          "Cache-Control": "private, max-age=0, must-revalidate",
          "ETag": `"${path}"`,
          "X-Content-Type-Options": "nosniff",
        };
        if (request.headers.get("If-None-Match") === headers.ETag)
          return new Response(null, { status: 304, headers });
        const file = await supabaseAdmin.storage.from("site-media").download(path);
        if (file.error || !file.data) return new Response("Not found", { status: 404 });
        return new Response(file.data, {
          headers: {
            "Content-Type": file.data.type,
            ...headers,
          },
        });
      },
    },
  },
});
