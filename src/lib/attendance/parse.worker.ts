import { parseAttendanceFile } from "./parse";
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    self.postMessage({ result: await parseAttendanceFile(event.data) });
  } catch {
    self.postMessage({ error: "Unable to import attendance." });
  }
};