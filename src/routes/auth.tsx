import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/", replace: true });
    }
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">NMU Business School</p>
            <p className="text-sm font-semibold text-foreground">Attendance Report Generator</p>
          </div>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
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
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Crafted by Tumi for NMU Business School.
        </p>
      </div>
    </div>
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
        <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

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
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          department: department.trim(),
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You are signed in.");
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="su-phone">Phone (optional)</Label>
          <Input id="su-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-dept">Department</Label>
          <Input id="su-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw">Password</Label>
        <Input id="su-pw" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw2">Confirm password</Label>
        <Input id="su-pw2" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
      </Button>
    </form>
  );
}