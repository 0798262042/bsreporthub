import { useNavigate } from "@tanstack/react-router";
import { Clock, XCircle, Ban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthBackground, authCardClass } from "@/components/AuthBackground";
import { useAuth, type ApprovalStatus } from "@/hooks/use-auth";

const COPY: Record<Exclude<ApprovalStatus, "approved">, { title: string; body: string; Icon: typeof Clock }> = {
  pending: {
    title: "Awaiting approval",
    body: "Your account is awaiting administrator approval. You will receive access once your registration has been reviewed.",
    Icon: Clock,
  },
  rejected: {
    title: "Registration not approved",
    body: "Your registration has not been approved. Please contact the system administrator if you require further information.",
    Icon: XCircle,
  },
  suspended: {
    title: "Account suspended",
    body: "Your account has been suspended. Please contact the system administrator for assistance.",
    Icon: Ban,
  },
};

export function AccountStatusScreen({ status }: { status: ApprovalStatus }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const c = COPY[status === "approved" ? "pending" : status];
  return (
    <AuthBackground>
      <div className={`${authCardClass} w-full max-w-md text-center`}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <c.Icon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">{c.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={async () => {
            await signOut();
            navigate({ to: "/", replace: true });
          }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
      </div>
    </AuthBackground>
  );
}
