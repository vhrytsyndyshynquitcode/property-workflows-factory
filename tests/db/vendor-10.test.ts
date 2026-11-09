import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch } from "./vendor-fixtures";

// AC-VENDOR-10: вендор без жодної задачі отримує порожній список запусків, хоча запуски агенції є.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): a vendor without tasks", () => {
  it("AC-VENDOR-10: vendor V to whom no task is assigned gets no run", async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    await launch(t, A, "Apartment 12, move-in");

    expect(await t.asUser(V, "select id from public.runs")).toEqual([]);
    expect(await t.asService("select count(*)::int as n from public.runs")).toEqual([{ n: 1 }]);
  });
});
