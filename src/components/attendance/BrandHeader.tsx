import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export function BrandHeader() {
  return (
    <header className="border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)] group-hover:scale-105 transition-transform">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              NMU Business School
            </p>
            <p className="text-sm font-semibold text-foreground">
              Attendance Report Generator
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
