import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { getTopStudents } from "./student-search";
import type { Report, StoredSession } from "./types";

function session(id: string, names: string[], date = "2026-11-01"): StoredSession {
  return { id, label: id, topic: "MBA Finance - Lecturer", date,
    startTime: `${date}T08:00:00Z`, endTime: `${date}T09:00:00Z`, sourceFilename: `${id}.csv`,
    attendees: names.map((name) => ({ name, rawName: name, joinTime: `${date}T08:00:00Z`, leaveTime: `${date}T09:00:00Z` })) };
}
function report(id: string, sessions: StoredSession[], hiddenNames: string[] = []): Report {
  return { id, name: "MBA Finance - Lecturer", category: "MBA", hiddenNames, sessions, createdAt: "", updatedAt: "" };
}

describe("Top five attendance ranking", () => {
  test("ranks all supplied reports by attended sessions and limits results to five", async () => {
    const names = ["Alice Cooper", "Bongani Dube", "Charlie Fox", "Diana Gray", "Evan Hill", "Fatima Khan"];
    const result = await getTopStudents([report("shared", [session("one", names)]), report("other", [session("two", [names[5]], "2026-11-02")])]);
    assert.equal(result.length, 5);
    assert.equal(result[0].name, "Fatima Khan");
    assert.equal(result[0].attended, 2);
  });
  test("counts duplicate entries and reimported sessions once", async () => {
    const result = await getTopStudents([report("a", [session("one", ["Alice Cooper", "ALICE COOPER"])]), report("b", [session("copy", ["Alice Cooper"])])]);
    assert.equal(result[0].attended, 1);
    assert.equal(result[0].totalSessions, 1);
  });
  test("merges device and partial names across reports using existing matching", async () => {
    const result = await getTopStudents([report("a", [session("one", ["Nomakhosi Ntliziyo"])]), report("b", [session("two", ["Nomakhosi's iPhone"], "2026-11-02")])]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Nomakhosi Ntliziyo");
    assert.equal(result[0].attended, 2);
  });
  test("calculates overall percentage using unique eligible report sessions", async () => {
    const result = await getTopStudents([report("a", [session("one", ["Alice Cooper"]), session("two", [], "2026-11-02")])]);
    assert.equal(result[0].attended, 1);
    assert.equal(result[0].totalSessions, 2);
    assert.equal(result[0].avgPct, 50);
  });
  test("returns fewer than five when fewer students exist and excludes hidden rows", async () => {
    const result = await getTopStudents([report("a", [session("one", ["Alice Cooper", "Lecturer Host"])], ["Lecturer Host"])]);
    assert.deepEqual(result.map((s) => s.name), ["Alice Cooper"]);
  });
  test("returns an empty list without attendance records", async () => {
    assert.deepEqual(await getTopStudents([report("a", [session("one", [])])]), []);
  });
  test("recalculates when new reports are supplied", async () => {
    const original = report("a", [session("one", ["Alice Cooper"])]);
    assert.equal((await getTopStudents([original]))[0].attended, 1);
    assert.equal((await getTopStudents([original, report("b", [session("two", ["Alice Cooper"], "2026-11-02")])]))[0].attended, 2);
  });
});