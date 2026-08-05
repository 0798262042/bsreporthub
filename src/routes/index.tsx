import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandHeader } from "@/components/attendance/BrandHeader";
import { useReports } from "@/hooks/use-reports";
import { usePrograms } from "@/hooks/use-programs";
import { useAuth } from "@/hooks/use-auth";
import { Landing } from "@/components/Landing";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { reports } = useReports();
  const { programs } = usePrograms();
  if (!session) return <Landing />;

  const counts: Record<string, number> = {};
  for (const r of reports) counts[r.category] = (counts[r.category] ?? 0) + 1;

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)]">
      <BrandHeader />

      <main className="mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-6 lg:px-8">
        <section className="max-w-3xl">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              MBA, PDBA & MMM Reports
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Turn Zoom attendance chaos into a{" "}
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent">
                polished report
              </span>
              .
            </h1>
          </div>
        </section>

        <section className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Recent reports
            </h2>
            <p className="text-sm text-muted-foreground">
              Grouped by programme
            </p>
          </div>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {CATEGORIES.map((c) => (
              <li key={c} className="h-full">
                <button
                  onClick={() =>
                    navigate({ to: "/category/$category", params: { category: c } })
                  }
                  className="w-full h-full min-h-[220px] flex flex-col text-left rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-white">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {counts[c]} report{counts[c] === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-foreground">
                    {CATEGORY_LABELS[c]}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {meta[c].blurb}
                  </p>
                  <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Open {CATEGORY_LABELS[c]} reports <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
