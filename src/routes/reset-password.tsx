import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthBackground, authCardClass } from "@/components/AuthBackground";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setReady(true);
        setChecking(false);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

        const errorDescription = query.get("error_description") ?? hash.get("error_description");
        if (errorDescription) {
          setLinkError(errorDescription);
          return;
        }

        // 1) PKCE style link: ?code=...
        const code = query.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setLinkError(error.message);
            return;
          }
          setReady(true);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }

        // 2) Token-hash style link: ?token_hash=...&type=recovery
        const tokenHash = query.get("token_hash") ?? query.get("token");
        const type = (query.get("type") ?? "recovery") as "recovery";
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
          if (error) {
            setLinkError(error.message);
            return;
          }
          setReady(true);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }

        // 3) Implicit style link: #access_token=...&refresh_token=...
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setLinkError(error.message);
            return;
          }
          setReady(true);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }

        // 4) Already-established recovery session
        const { data } = await supabase.auth.getSession();
        if (data.session) setReady(true);
      } finally {
        setChecking(false);
      }
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-white">Attendance Report Generator</p>
        </div>
        <div className={authCardClass}>
          <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
          {checking ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying your reset link…
            </p>
          ) : !ready ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {linkError
                  ? "This reset link is invalid or has expired."
                  : "Open this page from the reset link in your email."}
              </p>
              <Link to="/forgot-password" className="inline-block text-sm text-primary hover:underline">
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rp-pw">New password</Label>
                <PasswordInput id="rp-pw" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-pw2">Confirm password</Label>
                <PasswordInput id="rp-pw2" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </AuthBackground>
  );
}