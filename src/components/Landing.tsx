import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Upload,
  Sparkles,
  BarChart3,
  FileText,
  Download,
  CalendarDays,
  Search,
  Users,
  GraduationCap,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Upload,
    title: "Upload Excel Files",
    desc: "Drag and drop Zoom attendance exports and get started in seconds.",
    tint: "from-primary/15 to-primary/5 text-primary",
  },
  {
    icon: Sparkles,
    title: "Automatic Data Cleaning",
    desc: "Remove duplicates, normalize names, and keep the earliest join & latest leave times.",
    tint: "from-[color:var(--gold)]/25 to-[color:var(--gold)]/5 text-[color:var(--gold-ink)]",
  },
  {
    icon: BarChart3,
    title: "Attendance Analytics",
    desc: "Percentages calculated instantly with clear session-by-session insight.",
    tint: "from-primary/15 to-primary/5 text-primary",
  },
  {
    icon: FileText,
    title: "Professional Reports",
    desc: "Beautiful, brand-consistent PDF and Excel exports ready to share.",
    tint: "from-[color:var(--gold)]/25 to-[color:var(--gold)]/5 text-[color:var(--gold-ink)]",
  },
  {
    icon: Download,
    title: "One-Click Export",
    desc: "Download reports in PDF or styled Excel with a single click.",
    tint: "from-primary/15 to-primary/5 text-primary",
  },
  {
    icon: CalendarDays,
    title: "Session Management",
    desc: "Uploads are auto-organised into chronological, structured sessions.",
    tint: "from-[color:var(--gold)]/25 to-[color:var(--gold)]/5 text-[color:var(--gold-ink)]",
  },
  {
    icon: Search,
    title: "Search & Filter",
    desc: "Find students, filter by date range, and drill into any session.",
    tint: "from-primary/15 to-primary/5 text-primary",
  },
  {
    icon: Users,
    title: "Shared Repository",
    desc: "Reports are available to every signed-in staff member across the school.",
    tint: "from-[color:var(--gold)]/25 to-[color:var(--gold)]/5 text-[color:var(--gold-ink)]",
  },
];

const steps = [
  { icon: Upload, title: "Upload Excel File", desc: "Drop your Zoom attendance export." },
  { icon: Sparkles, title: "System Cleans Data", desc: "We normalize and organize automatically." },
  { icon: BarChart3, title: "Calculate Attendance", desc: "Percentages are computed instantly." },
  { icon: FileText, title: "Generate Report", desc: "Download polished PDF or Excel." },
];

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[image:var(--gradient-soft)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-[color:var(--gold)]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl"
      />

      {/* Nav */}
      <header className="relative z-20">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">Attendra</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">
              How it works
            </a>
            <a href="#about" className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors">
              About
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full px-5">
              <Link to="/auth">Login</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full px-5 bg-[color:var(--gold)] text-[color:var(--gold-ink)] hover:bg-[color:var(--gold)]/90 shadow-[var(--shadow-card)]"
            >
              <Link to="/auth">Register</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="mx-auto grid w-full max-w-[1400px] gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:pt-16">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              NMU Business School
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Attendra
            </h1>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">
                Business School Attendance Report
              </span>
            </p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Effortlessly transform attendance spreadsheets into accurate, professional reports. Simply
              upload your Excel file and let Attendra automatically clean the data, merge duplicate records,
              generate meaningful attendance insights, and produce beautifully formatted PDF and Excel
              reports in seconds.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full px-7 shadow-[var(--shadow-elevated)]"
              >
                <Link to="/auth">
                  Get Started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[color:var(--gold)]/50 bg-[color:var(--gold)] px-7 text-[color:var(--gold-ink)] hover:bg-[color:var(--gold)]/90"
              >
                <Link to="/auth">Login</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["Secure & private", "No installs", "Instant exports"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Mock dashboard preview */}
          <div className="relative">
            <div className="relative mx-auto w-full max-w-2xl">
              <div className="absolute -inset-6 rounded-[2rem] bg-[image:var(--gradient-brand)] opacity-20 blur-2xl" />
              <div className="relative rounded-3xl border border-border/60 bg-card/90 p-4 shadow-[var(--shadow-elevated)] backdrop-blur">
                <div className="flex items-center gap-1.5 pb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--gold)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                  <span className="ml-3 text-xs font-medium text-muted-foreground">attendra.app</span>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Attendance Report Overview</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Live
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {[
                      { l: "Students", v: "1,248" },
                      { l: "Sessions", v: "32" },
                      { l: "Reports", v: "78" },
                      { l: "Avg %", v: "82.4%" },
                    ].map((s) => (
                      <div key={s.l} className="rounded-xl border border-border bg-card p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.l}</p>
                        <p className="mt-1 text-lg font-bold text-foreground">{s.v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-foreground">Attendance %</p>
                      <svg viewBox="0 0 200 70" className="mt-2 h-16 w-full">
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="text-primary"
                          points="0,55 30,42 60,48 90,30 120,36 150,18 180,22 200,10"
                        />
                        <polyline
                          fill="url(#g)"
                          stroke="none"
                          points="0,55 30,42 60,48 90,30 120,36 150,18 180,22 200,10 200,70 0,70"
                          opacity="0.15"
                        />
                        <defs>
                          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" className="text-primary" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-foreground">Distribution</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div
                          className="h-16 w-16 rounded-full"
                          style={{
                            background:
                              "conic-gradient(var(--primary) 0 72%, var(--gold) 72% 88%, oklch(0.7 0.16 25) 88% 100%)",
                          }}
                        />
                        <ul className="space-y-1 text-[11px] text-muted-foreground">
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Present 72%</li>
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[color:var(--gold)]" /> Late 16%</li>
                          <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.7 0.16 25)" }} /> Absent 12%</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 bg-card/60 py-20 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Powerful features
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to move from raw Zoom exports to publication-ready reports.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, desc, tint }) => (
              <div
                key={title}
                className="group rounded-2xl border border-border bg-background p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tint}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 py-20">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              From spreadsheet to signed-off report in four simple steps.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-4">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="relative">
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[image:var(--gradient-brand)] text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <Icon className="h-5 w-5 text-[color:var(--gold-ink)]" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary/50 md:block" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* About / CTA */}
      <section id="about" className="relative z-10 pb-24">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-[image:var(--gradient-brand)] p-10 text-white shadow-[var(--shadow-elevated)] sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[color:var(--gold)]/40 blur-3xl"
            />
            <div className="relative grid gap-8 md:grid-cols-2 md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <ShieldCheck className="h-3.5 w-3.5" /> Built for Faculty & Administration
                </div>
                <h3 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to modernise your attendance workflow?
                </h3>
                <p className="mt-3 max-w-lg text-white/85">
                  Join NMU Business School staff already using Attendra to save hours every week and deliver
                  clean, professional reports on demand.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-[color:var(--gold)] px-7 text-[color:var(--gold-ink)] hover:bg-[color:var(--gold)]/90"
                  >
                    <Link to="/auth">
                      Get Started <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/40 bg-white/10 px-7 text-white hover:bg-white/20"
                  >
                    <Link to="/auth">Sign in</Link>
                  </Button>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Zap, t: "Lightning fast" },
                  { icon: ShieldCheck, t: "Secure by default" },
                  { icon: Users, t: "Shared across staff" },
                  { icon: FileText, t: "Polished PDF & Excel" },
                ].map(({ icon: Icon, t }) => (
                  <li
                    key={t}
                    className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}