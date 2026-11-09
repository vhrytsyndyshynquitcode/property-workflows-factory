import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, rowsOrNothing } from "./vendor-fixtures";

// AC-VENDOR-08: шаблони закриті для вендора і запитом напряму — ні шаблону, ні версії, ні задач (відмова або порожньо).
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): templates are closed to a vendor", () => {
  it("AC-VENDOR-08: vendor V gets no template, no template version and no template task", async () => {
    const V = await addVendor(t);
    expect(await t.asService("select role from public.profiles where id = $1", [V])).toEqual([{ role: "vendor" }]);

    expect(await rowsOrNothing(t.asUser(V, "select id, name from public.templates"))).toEqual([]);
    expect(await rowsOrNothing(t.asUser(V, "select id from public.template_versions"))).toEqual([]);
    expect(await rowsOrNothing(t.asUser(V, "select id from public.version_tasks"))).toEqual([]);
    expect(await rowsOrNothing(t.asUser(V, "select id from public.template_tasks"))).toEqual([]);
  });
});
