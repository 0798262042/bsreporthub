import { collectStudentNames, getStudentRecords, getTopStudents } from "./student-search";
import type { Report } from "./types";
let reports: Report[] = [];
self.onmessage = async (event: MessageEvent<{ type: "init" | "student"; reports?: Report[]; name?: string }>) => {
  try {
    if (event.data.type === "init") {
      reports = event.data.reports ?? [];
      const names = collectStudentNames(reports);
      self.postMessage({ type: "names", names });
      self.postMessage({ type: "ranking", students: await getTopStudents(reports) });
    } else {
      const name = event.data.name ?? "";
      self.postMessage({ type: "records", name, records: getStudentRecords(reports, name) });
    }
  } catch {
    self.postMessage({ type: "error" });
  }
};