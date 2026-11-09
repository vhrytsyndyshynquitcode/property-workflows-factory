import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch } from "./vendor-fixtures";

// AC-VENDOR-06: чужий запуск за прямим посиланням — база не віддає ні запуску, ні його задач.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): a run without the vendor's tasks", () => {
  it('AC-VENDOR-06: vendor V gets neither the run "Apartment 14, repair" nor any of its tasks by its id', async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });
    const other = await launch(t, A, "Apartment 14, repair");

    expect(await t.asUser(V, "select id from public.runs where id = $1", [other])).toEqual([]);
    expect(await t.asUser(V, "select id from public.run_tasks where run_id = $1", [other])).toEqual([]);
    // Запуск існує — порожньо саме через права вендора.
    expect(await t.asService("select count(*)::int as n from public.run_tasks where run_id = $1", [other])).toEqual([{ n: 5 }]);
  });
});
