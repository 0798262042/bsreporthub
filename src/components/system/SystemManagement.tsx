import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Save,
  Eye,
  Upload,
  RotateCcw,
  Send,
  Plus,
  Trash2,
  Loader2,
  Settings2,
  Image,
  Type,
  Palette,
  Bell,
  Mail,
  Info,
  PanelBottom,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  defaults,
  settingsSchema,
  mediaPaths,
  contrastText,
  validateImageBytes,
  type SiteSettings,
} from "@/lib/system/settings";
import { getManagedSettings, saveManagedSettings } from "@/lib/system/settings.functions";
import { SettingsPreview } from "./SettingsProvider";
import { Landing } from "@/components/Landing";
import { Footer } from "@/components/Footer";
import { SystemNotices } from "./SystemNotices";

const sections = [
  ["branding", "Website Branding", Globe],
  ["landing", "Landing Page Management", Settings2],
  ["images", "Logo and Image Management", Image],
  ["content", "Website Content Management", Type],
  ["info", "System Information", Info],
  ["theme", "Theme and Appearance", Palette],
  ["footer", "Footer Management", PanelBottom],
  ["contact", "Contact Information", Mail],
  ["notices", "System Notifications", Bell],
] as const;
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const id = "setting-" + label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3">
      <Label>{label}</Label>
      <Switch aria-label={label} checked={value} onCheckedChange={onChange} />
    </div>
  );
}
export function SystemManagement() {
  const load = useServerFn(getManagedSettings);
  const save = useServerFn(saveManagedSettings);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["managed-settings"],
    queryFn: () => load(),
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const [s, setS] = useState<SiteSettings>(defaults);
  const [baseline, setBaseline] = useState<SiteSettings>(defaults);
  const [revision, setRevision] = useState(0);
  const [section, setSection] = useState("branding");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const operation = useRef(false);
  const signedMedia = useRef<Record<string, { url: string; expires: number }>>({});
  useEffect(() => {
    if (query.data) {
      setS(query.data.draft);
      setBaseline(query.data.draft);
      setRevision(query.data.revision);
    }
  }, [query.data]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        [...new Set(mediaPaths(s))].map(async (path) => {
          const cached = signedMedia.current[path];
          if (cached && cached.expires > Date.now()) return [path, cached.url] as const;
          const { data, error } = await supabase.storage.from("site-media").createSignedUrl(path, 3600);
          if (error || !data) throw new Error("Could not load the stored image preview. Please try again.");
          signedMedia.current[path] = { url: data.signedUrl, expires: Date.now() + 3500000 };
          return [path, data.signedUrl] as const;
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(pairs));
    })().catch((error) => { if (!cancelled) toast.error(error.message); });
    return () => {
      cancelled = true;
    };
  }, [s.brand.logo, s.brand.favicon, s.landing.image]);
  function update<K extends keyof SiteSettings>(key: K, value: Partial<SiteSettings[K]>) {
    setS((prev) => ({ ...prev, [key]: { ...prev[key], ...value } }));
  }
  const dirty = JSON.stringify(s) !== JSON.stringify(baseline);
  async function action(kind: "save" | "publish" | "restore", content = s) {
    if (operation.current) return;
    const valid = settingsSchema.safeParse(content);
    if (!valid.success) {
      toast.error(valid.error.issues[0]?.message ?? "Check your settings.");
      return;
    }
    const removing =
      (!content.content.privacy.trim() && !!query.data?.published.content.privacy.trim()) ||
      (!content.content.terms.trim() && !!query.data?.published.content.terms.trim()) ||
      (!content.content.popia.trim() && !!query.data?.published.content.popia.trim());
    if (
      kind !== "save" &&
      !window.confirm(
        removing
          ? "This removes published legal content. Confirm removal and publish?"
          : kind === "restore"
            ? "Restore this published version across the website?"
            : "Publish these changes across the website?",
      )
    )
      return;
    operation.current = true;
    setBusy(true);
    try {
      const result = await save({ data: { action: kind, content, revision } });
      setRevision(result.revision);
      setBaseline(content);
      setS(content);
      await qc.invalidateQueries({ queryKey: ["managed-settings"] });
      if (kind !== "save") {
        qc.setQueryData(["published-settings"], result.content);
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("attendra-branding");
          channel.postMessage("published");
          channel.close();
        }
      }
      toast.success(
        kind === "save"
          ? "Draft saved. Visitors still see the published version."
          : kind === "restore"
            ? "Previous version restored."
            : "Changes published.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function upload(file: File, key: "logo" | "favicon" | "image") {
    if (operation.current) return;
    const types: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/x-icon": "ico",
      "image/vnd.microsoft.icon": "ico",
    };
    const ext = types[file.type] || (file.type === "" && /\.ico$/i.test(file.name) ? "ico" : "");
    if (!ext || file.size === 0 || file.size > 5 * 1024 * 1024) {
      toast.error("Upload a PNG, JPEG, WebP or ICO image up to 5 MB.");
      return;
    }
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const valid = validateImageBytes(bytes, ext, file.size);
    if (!valid) {
      toast.error("This file is not a supported image.");
      return;
    }
    const contentType = file.type || "image/x-icon";
    operation.current = true;
    setBusy(true);
    try {
      const path = crypto.randomUUID() + "." + ext;
      const { error } = await supabase.storage
        .from("site-media")
        .upload(path, file, { contentType, upsert: false });
      if (error) throw new Error("Could not store the image. Check your connection and try again.");
      const preview = await supabase.storage.from("site-media").createSignedUrl(path, 3600);
      if (preview.error || !preview.data) throw new Error("Image stored, but its preview could not be loaded. Please try again.");
      signedMedia.current[path] = { url: preview.data.signedUrl, expires: Date.now() + 3500000 };
      const content = key === "image"
        ? { ...s, landing: { ...s.landing, image: path } }
        : { ...s, brand: { ...s.brand, [key]: path } };
      setUrls((prev) => ({ ...prev, [path]: preview.data.signedUrl }));
      setS(content);
      const result = await save({ data: { action: "save", content, revision } });
      setRevision(result.revision);
      setBaseline(content);
      await qc.invalidateQueries({ queryKey: ["managed-settings"] });
      toast.success("Image stored and draft saved. Publish Changes to update the website.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload and save the image.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const imageEditor = (key: "logo" | "favicon" | "image", label: string) => {
    const path = key === "image" ? s.landing.image : s.brand[key];
    return (
      <div className="space-y-3 border-b border-border pb-6">
        <Label>{label}</Label>
        {path && urls[path] && (
          <img
            src={urls[path]}
            alt={label + " preview"}
            className="h-28 max-w-full rounded-md border border-border bg-muted object-contain"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild disabled={busy}>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Upload {label.toLowerCase()}
              <input
                type="file"
                aria-label={"Upload " + label.toLowerCase()}
                className="sr-only"
                accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file, key);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {path && (
            <Button
              variant="ghost"
              disabled={busy}
              aria-label={"Remove " + label.toLowerCase()}
              onClick={() =>
                key === "image" ? update("landing", { image: "" }) : update("brand", { [key]: "" })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
    );
  };
  const listEditor = (
    items: { title: string; desc: string }[],
    onChange: (v: { title: string; desc: string }[]) => void,
    label: string,
  ) => (
    <div className="space-y-4">
      <h3 className="font-semibold">{label}</h3>
      {items.map((item, i) => (
        <div key={i} className="space-y-3 border-b border-border pb-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {label} {i + 1}
            </span>
            <Button
              size="icon"
              variant="ghost"
              title="Remove item"
              onClick={() => {
                if (window.confirm("Remove this item from the draft?"))
                  onChange(items.filter((_, n) => n !== i));
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Field
            label={`${label} ${i + 1} title`}
            value={item.title}
            onChange={(v) => onChange(items.map((x, n) => (n === i ? { ...x, title: v } : x)))}
          />
          <Field
            multiline
            label={`${label} ${i + 1} description`}
            value={item.desc}
            onChange={(v) => onChange(items.map((x, n) => (n === i ? { ...x, desc: v } : x)))}
          />
        </div>
      ))}
      <Button variant="outline" onClick={() => onChange([...items, { title: "", desc: "" }])}>
        <Plus className="mr-2 h-4 w-4" />
        Add {label.toLowerCase()}
      </Button>
    </div>
  );
  const linksEditor = (key: "links" | "social") => (
    <div className="space-y-4">
      <h3 className="font-semibold">{key === "links" ? "Footer links" : "Social media links"}</h3>
      {s.footer[key].map((item, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field
            label={`${key} ${i + 1} label`}
            value={item.label}
            onChange={(v) =>
              update("footer", {
                [key]: s.footer[key].map((x, n) => (n === i ? { ...x, label: v } : x)),
              })
            }
          />
          <Field
            label={`${key} ${i + 1} destination`}
            value={item.url}
            onChange={(v) =>
              update("footer", {
                [key]: s.footer[key].map((x, n) => (n === i ? { ...x, url: v } : x)),
              })
            }
          />
          <Button
            className="self-end"
            size="icon"
            variant="ghost"
            title="Remove link"
            onClick={() => update("footer", { [key]: s.footer[key].filter((_, n) => n !== i) })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() => update("footer", { [key]: [...s.footer[key], { label: "", url: "" }] })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add link
      </Button>
    </div>
  );
  if (query.isPending)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  if (query.error)
    return (
      <div role="alert" className="py-8">
        <p>Could not load System Management.</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h2 className="text-2xl font-bold">System Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dirty ? "Unsaved changes" : "Draft saved"} · {query.data?.versions.length ?? 0}{" "}
            published versions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={busy || !dirty}
            onClick={() => {
              if (window.confirm("Discard unsaved changes?")) setS(baseline);
            }}
          >
            Cancel
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setPreview(true)}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => action("save")}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
          <Button disabled={busy} onClick={() => action("publish")}>
            <Send className="mr-2 h-4 w-4" />
            Publish Changes
          </Button>
        </div>
      </div>
      <div className="grid gap-8 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="flex flex-wrap gap-1 lg:flex-col">
          {sections.map(([id, label, Icon]) => (
            <Button
              key={id}
              variant={id === section ? "secondary" : "ghost"}
              className="justify-start text-left"
              onClick={() => setSection(id)}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0" />
              {label}
            </Button>
          ))}
        </nav>
        <div className="min-w-0 max-w-4xl space-y-6">
          <h3 className="text-xl font-semibold">{sections.find((x) => x[0] === section)?.[1]}</h3>
          {section === "branding" && (
            <>
              <Field
                label="System name"
                value={s.brand.name}
                onChange={(v) => update("brand", { name: v })}
              />
              <Field
                label="Organisation"
                value={s.brand.organisation}
                onChange={(v) => update("brand", { organisation: v })}
              />
              <Toggle
                label="Logo in navigation"
                value={s.brand.navLogo}
                onChange={(v) => update("brand", { navLogo: v })}
              />
              <Toggle
                label="Logo on login page"
                value={s.brand.authLogo}
                onChange={(v) => update("brand", { authLogo: v })}
              />
              <Toggle
                label="Logo on landing page"
                value={s.brand.landingLogo}
                onChange={(v) => update("brand", { landingLogo: v })}
              />
            </>
          )}
          {section === "images" && (
            <>
              {imageEditor("logo", "Logo")}
              {imageEditor("favicon", "Favicon")}
              {imageEditor("image", "Landing image")}
            </>
          )}
          {section === "landing" && (
            <>
              <Field
                label="Main heading"
                value={s.landing.heading}
                onChange={(v) => update("landing", { heading: v })}
              />
              <Field
                label="Subtitle"
                value={s.landing.subtitle}
                onChange={(v) => update("landing", { subtitle: v })}
              />
              <Field
                multiline
                label="Landing description"
                value={s.landing.description}
                onChange={(v) => update("landing", { description: v })}
              />
              <Field
                label="Tagline"
                value={s.landing.tagline}
                onChange={(v) => update("landing", { tagline: v })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Call-to-action text"
                  value={s.landing.cta}
                  onChange={(v) => update("landing", { cta: v })}
                />
                <Field
                  label="Call-to-action destination"
                  value={s.landing.ctaUrl}
                  onChange={(v) => update("landing", { ctaUrl: v })}
                />
              </div>
              <Toggle
                label="Show features"
                value={s.landing.showFeatures}
                onChange={(v) => update("landing", { showFeatures: v })}
              />
              <Field
                label="Features heading"
                value={s.landing.featuresTitle}
                onChange={(v) => update("landing", { featuresTitle: v })}
              />
              <Field
                multiline
                label="Features description"
                value={s.landing.featuresDescription}
                onChange={(v) => update("landing", { featuresDescription: v })}
              />
              {listEditor(s.landing.features, (v) => update("landing", { features: v }), "Feature")}
              <Toggle
                label="Show how it works"
                value={s.landing.showHow}
                onChange={(v) => update("landing", { showHow: v })}
              />
              <Field
                label="How it works heading"
                value={s.landing.howTitle}
                onChange={(v) => update("landing", { howTitle: v })}
              />
              <Field
                multiline
                label="How it works description"
                value={s.landing.howDescription}
                onChange={(v) => update("landing", { howDescription: v })}
              />
              {listEditor(s.landing.steps, (v) => update("landing", { steps: v }), "Step")}
              <Toggle
                label="Show about"
                value={s.landing.showAbout}
                onChange={(v) => update("landing", { showAbout: v })}
              />
              <Field
                label="About heading"
                value={s.landing.aboutTitle}
                onChange={(v) => update("landing", { aboutTitle: v })}
              />
              <Field
                multiline
                label="About description"
                value={s.landing.aboutDescription}
                onChange={(v) => update("landing", { aboutDescription: v })}
              />
            </>
          )}
          {section === "content" && (
            <>
              <Field
                multiline
                label="About Attendra"
                value={s.content.about}
                onChange={(v) => update("content", { about: v })}
              />
              <Field
                multiline
                label="Privacy notice"
                value={s.content.privacy}
                onChange={(v) => update("content", { privacy: v })}
              />
              <Field
                multiline
                label="POPIA information"
                value={s.content.popia}
                onChange={(v) => update("content", { popia: v })}
              />
              <Field
                multiline
                label="Terms and conditions"
                value={s.content.terms}
                onChange={(v) => update("content", { terms: v })}
              />
              {listEditor(s.content.faq, (v) => update("content", { faq: v }), "Question")}
            </>
          )}
          {section === "info" && (
            <>
              <Field
                label="Platform name"
                value={s.brand.name}
                onChange={(v) => update("brand", { name: v })}
              />
              <Field
                multiline
                label="System description"
                value={s.content.description}
                onChange={(v) => update("content", { description: v })}
              />
              <Field
                multiline
                label="Support contact details"
                value={s.contact.support}
                onChange={(v) => update("contact", { support: v })}
              />
            </>
          )}
          {section === "theme" && (
            <>
              <Label>Theme</Label>
              <Select
                value={s.theme.mode}
                onValueChange={(v) => update("theme", { mode: v as "light" | "dark" })}
              >
                <SelectTrigger aria-label="Theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid gap-5 sm:grid-cols-2">
                {(["primary", "secondary", "background", "button"] as const).map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <Input
                      className="h-10 w-14 p-1"
                      type="color"
                      aria-label={key + " colour"}
                      value={s.theme[key] || "#061c2c"}
                      onChange={(e) => update("theme", { [key]: e.target.value })}
                    />
                    <Label className="capitalize">{key} colour</Label>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={"Reset " + key + " colour"}
                      onClick={() => update("theme", { [key]: "" })}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Label>Navigation appearance</Label>
              <Select
                value={s.theme.navigation}
                onValueChange={(v) => update("theme", { navigation: v as "solid" | "translucent" })}
              >
                <SelectTrigger aria-label="Navigation appearance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="translucent">Translucent</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {section === "footer" && (
            <>
              <Field
                label="Copyright text"
                value={s.footer.copyright}
                onChange={(v) => update("footer", { copyright: v })}
              />
              <Field
                label="Footer platform name"
                value={s.footer.name}
                onChange={(v) => update("footer", { name: v })}
              />
              <Field
                multiline
                label="Footer description"
                value={s.footer.description}
                onChange={(v) => update("footer", { description: v })}
              />
              {linksEditor("links")}
              {linksEditor("social")}
            </>
          )}
          {section === "contact" && (
            <>
              <Field
                label="Contact email"
                value={s.contact.email}
                onChange={(v) => update("contact", { email: v })}
              />
              <Field
                label="Telephone"
                value={s.contact.phone}
                onChange={(v) => update("contact", { phone: v })}
              />
              <Field
                multiline
                label="Address"
                value={s.contact.address}
                onChange={(v) => update("contact", { address: v })}
              />
              <Field
                multiline
                label="Support details"
                value={s.contact.support}
                onChange={(v) => update("contact", { support: v })}
              />
            </>
          )}
          {section === "notices" && (
            <>
              {s.notices.map((n, i) => (
                <div key={n.id} className="space-y-4 border-b border-border pb-6">
                  <Field
                    label={`Notice ${i + 1} title`}
                    value={n.title}
                    onChange={(v) =>
                      setS({
                        ...s,
                        notices: s.notices.map((x, j) => (j === i ? { ...x, title: v } : x)),
                      })
                    }
                  />
                  <Field
                    multiline
                    label={`Notice ${i + 1} message`}
                    value={n.message}
                    onChange={(v) =>
                      setS({
                        ...s,
                        notices: s.notices.map((x, j) => (j === i ? { ...x, message: v } : x)),
                      })
                    }
                  />
                  <Toggle
                    label={`Activate notice ${i + 1}`}
                    value={n.active}
                    onChange={(v) =>
                      setS({
                        ...s,
                        notices: s.notices.map((x, j) => (j === i ? { ...x, active: v } : x)),
                      })
                    }
                  />
                  <Select
                    value={n.audience}
                    onValueChange={(v) =>
                      setS({
                        ...s,
                        notices: s.notices.map((x, j) =>
                          j === i ? { ...x, audience: v as "all" | "staff" } : x,
                        ),
                      })
                    }
                  >
                    <SelectTrigger aria-label={`Notice ${i + 1} audience`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="staff">Signed-in users</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={n.kind}
                    onValueChange={(v) =>
                      setS({
                        ...s,
                        notices: s.notices.map((x, j) =>
                          j === i ? { ...x, kind: v as typeof n.kind } : x,
                        ),
                      })
                    }
                  >
                    <SelectTrigger aria-label={`Notice ${i + 1} type`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm("Remove this announcement from the draft?"))
                        setS({ ...s, notices: s.notices.filter((_, j) => j !== i) });
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove notice
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() =>
                  setS({
                    ...s,
                    notices: [
                      ...s.notices,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        message: "",
                        active: false,
                        audience: "staff",
                        kind: "general",
                      },
                    ],
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add announcement
              </Button>
            </>
          )}
          <div className="border-t border-border pt-6">
            <h3 className="font-semibold">Published history</h3>
            <div className="mt-3 space-y-2">
              {query.data?.versions.map((v, i) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"
                >
                  <span className="text-sm text-muted-foreground">
                    {new Date(v.published_at).toLocaleString()} {i === 0 ? "· Current" : ""}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || i === 0}
                    onClick={() => action("restore", v.content)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[1400px] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Draft preview</DialogTitle>
            <DialogDescription>Not published</DialogDescription>
          </DialogHeader>
          <div
            className={s.theme.mode === "dark" ? "dark" : ""}
            style={
              {
                ...(s.theme.primary
                  ? {
                      "--primary": s.theme.primary,
                      "--primary-foreground": contrastText(s.theme.primary),
                      "--gradient-brand": `linear-gradient(135deg,${s.theme.primary},${s.theme.primary})`,
                    }
                  : {}),
                ...(s.theme.background
                  ? {
                      "--background": s.theme.background,
                      "--foreground": contrastText(s.theme.background),
                    }
                  : {}),
                ...(s.theme.secondary
                  ? {
                      "--secondary": s.theme.secondary,
                      "--secondary-foreground": contrastText(s.theme.secondary),
                    }
                  : {}),
                ...(s.theme.button
                  ? {
                      "--primary": s.theme.button,
                      "--primary-foreground": contrastText(s.theme.button),
                    }
                  : {}),
              } as React.CSSProperties
            }
          >
            <SettingsPreview settings={s} media={urls}>
              <div className="pointer-events-none">
                <SystemNotices />
                <Landing previewMedia={urls} />
                <Footer />
              </div>
            </SettingsPreview>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
