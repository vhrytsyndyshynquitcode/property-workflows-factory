import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch, runTasks } from "./vendor-fixtures";

// AC-VENDOR-01 (openspec/specs/vendor-access): вендор — виконавець задач, призначених йому під час запуску;
// решта задач — менеджеру запуску. Правило живе в public.launch_run — тест бази (PGlite), не мок rpc.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): assign a vendor at launch", () => {
  it("AC-VENDOR-01: manager A assigns vendor V to tasks 3 and 4; tasks 3 and 4 have V, tasks 1, 2 and 5 have A", async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);

    const runId = await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });

    const tasks = await runTasks(t, runId);
    expect(tasks).toHaveLength(5);
    expect(tasks.map((x) => [x.position, x.assignee_id])).toEqual([
      [1, A],
      [2, A],
      [3, V],
      [4, V],
      [5, A],
    ]);
  });
});
