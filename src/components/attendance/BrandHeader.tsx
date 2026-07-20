import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BrandHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out.");
    navigate({ to: "/auth", replace: true });
  }

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
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
              {isAdmin ? (
                <ShieldCheck className="h-4 w-4 text-primary" />
              ) : (
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">{user.email}</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                {isAdmin ? "Admin" : "User"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
