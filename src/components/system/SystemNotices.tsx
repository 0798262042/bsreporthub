import { useSiteSettings } from "./SettingsProvider";
import { useAuth } from "@/hooks/use-auth";
import { Bell, TriangleAlert } from "lucide-react";
export function SystemNotices() {
  const s = useSiteSettings();
  const { session } = useAuth();
  return (
    <>
      {s.notices
        .filter((n) => n.active && (n.audience === "all" || session))
        .map((n) => (
          <div
            key={n.id}
            role="status"
            className="flex items-start gap-3 border-b border-border bg-accent px-4 py-3 text-accent-foreground sm:px-8"
          >
            {n.kind === "general" ? (
              <Bell className="mt-1 h-4 w-4 shrink-0" />
            ) : (
              <TriangleAlert className="mt-1 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 break-words">
              <p className="font-semibold">{n.title}</p>
              <p className="whitespace-pre-wrap text-sm">{n.message}</p>
            </div>
          </div>
        ))}
    </>
  );
}
