import { useSiteSettings } from "@/components/system/SettingsProvider";
export function Footer() {
  const year = new Date().getFullYear();
  const s = useSiteSettings();
  return (
    <footer className="mt-auto border-t border-border bg-background/60">
      <div className="mx-auto w-full max-w-[1600px] space-y-3 px-4 py-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs text-muted-foreground sm:text-sm">{s.footer.copyright.replaceAll("{year}",String(year)).replaceAll("{name}",s.footer.name)}</p>
        {s.footer.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.footer.description}</p>}
        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">{s.contact.email && <a href={"mailto:"+s.contact.email}>{s.contact.email}</a>}{s.contact.phone && <span>{s.contact.phone}</span>}{s.contact.address && <span>{s.contact.address}</span>}{s.contact.support && <span>{s.contact.support}</span>}</div>
        <nav className="flex flex-wrap justify-center gap-4">{[...s.footer.links,...s.footer.social].map((l,i)=><a key={i} href={l.url} className="text-sm text-primary hover:underline">{l.label}</a>)}</nav>
      </div>
    </footer>
  );
}
