import { test } from "node:test";
import { strict as assert } from "node:assert";
import XLSX from "xlsx-js-style";
import { buildAllReportsExcel } from "./export-all-excel";
import type { Report } from "./types";
test("bulk export remains one workbook with dynamically named worksheets and stored attendance", async () => {
  const reports: Report[] = ["Finance", "Maritime"].map((name, i) => ({
    id: String(i), name, category: "MBA", hiddenNames: [], createdAt: "", updatedAt: "",
    sessions: [{ id: String(i), label: "Session 1", topic: name, date: "2026-11-05", startTime: "2026-11-05T09:00:00Z", endTime: "2026-11-05T10:00:00Z", sourceFilename: "attendance.xlsx", attendees: [{ name: "Alice Cooper", rawName: "Alice Cooper", joinTime: "2026-11-05T09:00:00Z", leaveTime: "2026-11-05T10:00:00Z" }] }],
  }));
  const result = buildAllReportsExcel(reports);
  const workbook = XLSX.read(await result.blob.arrayBuffer(), { type: "array" });
  assert.equal(result.sheets, 2);
  assert.deepEqual(workbook.SheetNames, ["Finance", "Maritime"]);
  for (const name of workbook.SheetNames) {
    assert.equal(workbook.Sheets[name].A6.v, "Alice Cooper");
    assert.equal(workbook.Sheets[name].D6.v, 1);
  }
});