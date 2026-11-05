import { Link, useNavigate } from "@tanstack/react-router";
import { GraduationCap, LayoutDashboard, LogOut, ShieldCheck, User as UserIcon, UserSearch } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrandMark } from "@/components/system/BrandMark";
import { useSiteSettings } from "@/components/system/SettingsProvider";
import { logActivity } from "@/lib/activity";

export function BrandHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const settings = useSiteSettings();

  async function handleSignOut() {
    await logActivity({ action: "user.logout" });
    await signOut();
    toast.success("Signed out.");
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="navigation-theme border-b border-border/60 bg-navigation text-navigation-foreground sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <BrandMark location="nav" />
          <div className="leading-tight">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {settings.brand.organisation}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {settings.content.description}
            </p>
          </div>
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student-search">
                <UserSearch className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Student Search</span>
              </Link>
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin">
                  <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              </Button>
            )}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-navigation px-3 py-1.5">
              {isAdmin ? (
                <ShieldCheck className="h-4 w-4 text-navigation-foreground" />
              ) : (
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-medium text-foreground">{user.email}</span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
                {isAdmin ? "Admin" : "User"}
              </span>
            </div>
            <Button variant="outline" size="sm" className="bg-navigation text-navigation-foreground hover:text-accent-foreground" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
