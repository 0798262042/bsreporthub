import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { BrandMark } from "@/components/system/BrandMark";
import { useSiteSettings } from "@/components/system/SettingsProvider";
import { AuthBackground, authCardClass } from "@/components/AuthBackground";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{title: "Sign in — Attendra"},{name:"description",content:"Sign in or register for approved access to Attendra attendance reports."},{property:"og:title",content:"Sign in — Attendra"},{property:"og:description",content:"Sign in or register for approved access to Attendra attendance reports."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const settings = useSiteSettings();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/", replace: true });
    }
  }, [session, loading, navigate]);

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <BrandMark location="auth" />
          <div className="leading-tight text-left">
            <p className="text-[10px] uppercase tracking-widest text-white/80">{settings.brand.organisation}</p>
            <p className="text-sm font-semibold text-white">{settings.content.description}</p>
          </div>
        </Link>

        <div className={authCardClass}>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-6">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-6">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthBackground>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      if (/banned/i.test(error.message)) {
        toast.error("Your account has been suspended. Please contact the system administrator for assistance.");
        return;
      }
      toast.error(error.message.includes("Invalid") ? "Invalid email or password." : error.message);
      return;
    }
    if (!remember) {
      // Best effort: clear the persisted refresh token so the session ends on tab close.
      try {
        sessionStorage.setItem("sb-remember", "0");
      } catch {
        // ignore
      }
    }
    toast.success("Signed in.");
    navigate({ to: "/", replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="si-password">Password</Label>
        <PasswordInput id="si-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
          Remember me
        </label>
        <Link to="/forgot-password" className="text-sm text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      toast.error("Please acknowledge the privacy notice to register.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      "Registration successful! Your account is awaiting administrator approval. You will be able to access Attendra once your account has been approved.",
      { duration: 10000 },
    );
    navigate({ to: "/", replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="su-first">First name</Label>
          <Input id="su-first" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-last">Last name</Label>
          <Input id="su-last" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw">Password</Label>
        <PasswordInput id="su-pw" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw2">Confirm password</Label>
        <PasswordInput id="su-pw2" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">Privacy notice (POPIA)</p>
        <p className="mt-1">
          {settings.content.privacy}
        </p>
        {settings.content.popia && <p className="mt-2">{settings.content.popia}</p>}
        {settings.content.terms && <details className="mt-2"><summary>Terms and conditions</summary><p>{settings.content.terms}</p></details>}
        <label className="mt-2 flex items-start gap-2 text-foreground">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
          I have read and understand this notice.
        </label>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
      </Button>
    </form>
  );
}