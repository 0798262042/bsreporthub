import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { defaults, contrastText, mediaUrl, faviconType, type SiteSettings } from "@/lib/system/settings";
import { getPublishedSettings } from "@/lib/system/settings.functions";
const Context = createContext<SiteSettings>(defaults);
const MediaContext = createContext<Record<string, string>>({});
export const useSiteSettings = () => useContext(Context);
export const usePreviewMedia = () => useContext(MediaContext);
export function SettingsPreview({
  settings,
  children,
  media = {},
}: {
  settings: SiteSettings;
  children: ReactNode;
  media?: Record<string, string>;
}) {
  return (
    <Context.Provider value={settings}>
      <MediaContext.Provider value={media}>{children}</MediaContext.Provider>
    </Context.Provider>
  );
}
export const publishedSettingsQuery = {
  queryKey: ["published-settings"],
  queryFn: () => getPublishedSettings(),
  staleTime: 60000,
};
/** CSS for published theme tokens, rendered during SSR so the first paint already uses them. */
function themeCss(s: SiteSettings) {
  const vars: string[] = [];
  const add = (k: string, v: string) => vars.push(`--${k}:${v}`);
  const primary = s.theme.button || s.theme.primary;
  if (primary) { add("primary", primary); add("primary-foreground", contrastText(primary)); }
  if (s.theme.secondary) { add("secondary", s.theme.secondary); add("secondary-foreground", contrastText(s.theme.secondary)); }
  if (s.theme.background) { add("background", s.theme.background); add("foreground", contrastText(s.theme.background)); }
  if (s.theme.primary) { add("gradient-brand", `linear-gradient(135deg, ${s.theme.primary}, ${s.theme.primary})`); add("ring", s.theme.primary); }
  return vars.length ? `:root{${vars.join(";").replace(/[<>{}]/g, "")}}` : "";
}
export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: SiteSettings }) {
  const qc = useQueryClient();
  const { data = initial ?? defaults } = useQuery({
    ...publishedSettingsQuery,
    initialData: initial,
    refetchInterval: 60000,
  });
  useEffect(() => {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("attendra-branding");
    if (channel) channel.onmessage = () => { void qc.invalidateQueries({ queryKey: ["published-settings"] }); };
    return () => channel?.close();
  }, [qc]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", data.theme.mode === "dark");
    const pairs = [
      ["primary", data.theme.button || data.theme.primary],
      ["secondary", data.theme.secondary],
      ["background", data.theme.background],
    ];
    for (const [token, value] of pairs) {
      if (value) {
        root.style.setProperty(`--${token}`, value);
        if (token !== "background")
          root.style.setProperty(`--${token}-foreground`, contrastText(value));
        else root.style.setProperty("--foreground", contrastText(value));
      } else {
        root.style.removeProperty(`--${token}`);
        root.style.removeProperty(
          `--${token === "background" ? "foreground" : token + "-foreground"}`,
        );
      }
    }
    if (data.theme.primary) {
      root.style.setProperty(
        "--gradient-brand",
        `linear-gradient(135deg, ${data.theme.primary}, ${data.theme.primary})`,
      );
      root.style.setProperty("--ring", data.theme.primary);
    } else {
      root.style.removeProperty("--gradient-brand");
      root.style.removeProperty("--ring");
    }
    // Replace every icon reference so a stale shortcut icon cannot override the new file.
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((icon) => icon.remove());
    for (const rel of ["icon", "shortcut icon"]) {
      const icon = document.createElement("link");
      icon.rel = rel;
      icon.type = data.brand.favicon ? faviconType(data.brand.favicon) : "image/x-icon";
      icon.href = mediaUrl(data.brand.favicon) || "/favicon.ico";
      if (data.brand.favicon.endsWith(".ico")) icon.setAttribute("sizes", "16x16 32x32 48x48");
      document.head.append(icon);
    }
  }, [data]);
  const css = themeCss(data);
  return (
    <Context.Provider value={data}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
    </Context.Provider>
  );
}
