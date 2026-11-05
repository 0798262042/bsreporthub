import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listReports, getReport, listReportCategories } from "@/lib/attendance/storage";
import { useAuth } from "./use-auth";
const EMPTY_REPORTS: Awaited<ReturnType<typeof listReports>> = [];

export function useReports(category?: string) {
  const { user, approvalStatus } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["attendance-reports", user?.id, category ?? "all"],
    queryFn: () => listReports(category),
    enabled: !!user && approvalStatus === "approved",
    staleTime: 60000,
  });
  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["attendance-reports"] }); }, [qc]);
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("nmu-reports-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nmu-reports-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return { reports: query.data ?? EMPTY_REPORTS, refresh, loading: query.isPending, error: query.error };
}

export function useReportCategories() {
  const { user, approvalStatus } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["attendance-categories", user?.id], queryFn: listReportCategories, enabled: !!user && approvalStatus === "approved", staleTime: 60000 });
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["attendance-categories"] }); };
    window.addEventListener("nmu-reports-changed", refresh);
    return () => window.removeEventListener("nmu-reports-changed", refresh);
  }, [qc]);
  return { reports: query.data ?? [] };
}

export function useReport(id: string | undefined) {
  const { user, approvalStatus } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["attendance-report", user?.id, id], queryFn: () => id ? getReport(id) : null, enabled: !!id && !!user && approvalStatus === "approved", staleTime: 60000 });
  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ["attendance-report", user?.id, id] }); }, [qc, user?.id, id]);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("nmu-reports-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nmu-reports-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return { report: query.data ?? null, refresh, loading: !!id && query.isPending, error: query.error };
}
