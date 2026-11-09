import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch } from "./vendor-fixtures";

// AC-VENDOR-03: вендор бачить лише запуски, де він виконавець хоча б однієї задачі (RLS public.runs).
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): runs list of a vendor", () => {
  it('AC-VENDOR-03: vendor V sees only "Apartment 12, move-in" with its run status and 2 own tasks, not "Apartment 14, repair"', async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });
    await launch(t, A, "Apartment 14, repair");

    const runs = await t.asUser<{ case_name: string; status: string; own: number }>(
      V,
      `select r.case_name, r.status,
              (select count(*)::int from public.run_tasks k where k.run_id = r.id and k.assignee_id = $1) as own
       from public.runs r order by r.case_name`,
      [V],
    );

    expect(runs).toEqual([{ case_name: "Apartment 12, move-in", status: "in_progress", own: 2 }]);
  });
});
