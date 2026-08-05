import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_TOKENS } from "@/lib/attendance/types";

export type Program = {
  id: string;
  code: string;
  label: string;
  blurb: string;
  tokens: string[];
  sort_order: number;
};

const FALLBACK: Program[] = CATEGORIES.map((c, i) => ({
  id: c,
  code: c,
  label: CATEGORY_LABELS[c] ?? c,
  blurb: "",
  tokens: CATEGORY_TOKENS[c] ?? [c],
  sort_order: i + 1,
}));

const PROGRAMS_CHANGED = "nmu-programs-changed";

export function notifyProgramsChanged() {
  window.dispatchEvent(new Event(PROGRAMS_CHANGED));
}

export function usePrograms() {
  const [programs, setPrograms] = useState<Program[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("programs")
      .select("id, code, label, blurb, tokens, sort_order")
      .order("sort_order", { ascending: true });
    if (!error && data && data.length > 0) {
      setPrograms(
        data.map((p) => ({
          id: p.id as string,
          code: p.code as string,
          label: (p.label as string) || (p.code as string),
          blurb: (p.blurb as string) ?? "",
          tokens: Array.isArray(p.tokens) ? (p.tokens as string[]) : [],
          sort_order: (p.sort_order as number) ?? 0,
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(PROGRAMS_CHANGED, onChange);
    return () => window.removeEventListener(PROGRAMS_CHANGED, onChange);
  }, [refresh]);

  return { programs, loading, refresh };
}
