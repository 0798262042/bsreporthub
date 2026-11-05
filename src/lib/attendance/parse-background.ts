import type { ParsedFile } from "./parse";
/** Keep spreadsheet decoding and fuzzy merging off the page's input thread. */
export function parseAttendanceFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ result?: ParsedFile; error?: string }>) => {
      worker.terminate();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error || "Unable to import attendance."));
    };
    worker.onerror = () => { worker.terminate(); reject(new Error("Unable to import attendance.")); };
    worker.postMessage(file);
  });
}