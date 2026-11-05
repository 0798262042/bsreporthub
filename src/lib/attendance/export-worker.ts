import type { Report } from "./types";
type Result = { blob: Blob; filename: string; sheets: number };
/** A fresh worker owns workbook memory and is released after each export. */
export function exportAllInWorker(reports: Report[]): Promise<Result> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./workbook.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<Result & { error?: string }>) => {
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.onerror = () => { worker.terminate(); reject(new Error("Could not prepare the workbook. Please try again.")); };
    worker.postMessage(reports);
  });
}