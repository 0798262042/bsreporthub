import { buildAllReportsExcel } from "./export-all-excel";
import type { Report } from "./types";
self.onmessage = (event: MessageEvent<Report[]>) => {
  try {
    self.postMessage(buildAllReportsExcel(event.data));
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Could not prepare the workbook." });
  }
};