import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch, runTasks } from "./vendor-fixtures";

// AC-VENDOR-07: вендор напряму (rpc чи update таблиці) не позначає задачу, де він не виконавець.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): a vendor cannot mark another user's task", () => {
  it('AC-VENDOR-07: vendor V marks task 1 of manager A directly; task 1 stays "to do"', async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    const runId = await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });
    const before = await runTasks(t, runId);
    expect(before.map((x) => x.assignee_id)).toEqual([A, A, V, V, A]);
    const [task1] = await t.asService<{ id: string }>("select id from public.run_tasks where run_id = $1 and position = 1", [runId]);

    await expect(t.asUser(V, "select public.mark_task_done($1)", [task1.id])).rejects.toThrow(/NOT_ALLOWED/);
    await expect(
      t.asUser(V, "update public.run_tasks set status = 'done' where id = $1", [task1.id]),
    ).rejects.toThrow(/permission denied/);

    const after = await runTasks(t, runId);
    expect(after.find((x) => x.position === 1)?.status).toBe("to_do");
    expect(after).toEqual(before);
  });
});
