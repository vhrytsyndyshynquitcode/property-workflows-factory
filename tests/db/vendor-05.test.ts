import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch, runTasks } from "./vendor-fixtures";

// AC-VENDOR-05: вендор позначає виконаною свою задачу (public.mark_task_done); задача 3 — не остання обов'язкова.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): a vendor marks their task done", () => {
  it('AC-VENDOR-05: vendor V marks task 3 done; task 3 is "done" and 1 of the 2 tasks of V is done', async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    const runId = await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });
    const [task3] = await t.asService<{ id: string }>("select id from public.run_tasks where run_id = $1 and position = 3", [runId]);

    const [res] = await t.asUser<{ status: string }>(V, "select public.mark_task_done($1) as status", [task3.id]);

    expect(res.status).toBe("in_progress");
    const tasks = await runTasks(t, runId);
    expect(tasks.find((x) => x.position === 3)?.status).toBe("done");
    const own = tasks.filter((x) => x.assignee_id === V);
    expect([own.filter((x) => x.status === "done").length, own.length]).toEqual([1, 2]);
  });
});
