import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  message = "Loading...",
  className,
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-background animate-in fade-in duration-200",
        fullScreen ? "min-h-screen" : "min-h-[40vh] w-full",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-5 text-center px-6">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-[hsl(45,90%,55%)] animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Attendra
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}