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
  "rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-white/10";