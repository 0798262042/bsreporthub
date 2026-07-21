import type { ReactNode } from "react";
import bgAsset from "@/assets/nelson-mandela.png.asset.json";

export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgAsset.url})` }}
      />
      <div aria-hidden className="absolute inset-0 bg-black/40" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/30 via-black/20 to-black/50" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}

export const authCardClass =
  "rounded-2xl border border-white/40 bg-white/80 p-6 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 " +
  "[&_label]:text-slate-800 [&_label]:font-medium " +
  "[&_input]:bg-white [&_input]:text-slate-900 [&_input]:border [&_input]:border-slate-200 [&_input]:rounded-lg [&_input]:shadow-sm " +
  "[&_input]:placeholder:text-slate-400 [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-primary/40 [&_input:focus-visible]:border-primary/50";