import { useEffect, useState, useCallback } from "react";
import { listReports, getReport } from "@/lib/attendance/storage";
import type { Report } from "@/lib/attendance/types";

export function useReports() {
  const [reports, setReports] = useState<Report[]>([]);

  const refresh = useCallback(() => {
    listReports().then(setReports).catch(() => setReports([]));
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("nmu-reports-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nmu-reports-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return { reports, refresh };
}

export function useReport(id: string | undefined) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(() => {
    if (!id) {
      setReport(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getReport(id)
      .then((r) => {
        setReport(r);
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("nmu-reports-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nmu-reports-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return { report, refresh, loading };
}
