import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch, rowsOrNothing } from "./vendor-fixtures";

// AC-VENDOR-04: у запуску вендор бачить лише свої задачі (RLS public.run_tasks), без email інших користувачів.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

type TaskRow = { position: number; name: string; section_name: string; is_required: boolean; status: string };

describe("vendor-access (db): a run seen by a vendor", () => {
  it('AC-VENDOR-04: vendor V sees exactly tasks 3 and 4 of "Apartment 12, move-in" and no emails of other users', async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    const runId = await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });

    const tasks = await t.asUser<TaskRow>(
      V,
      "select position, name, section_name, is_required, status from public.run_tasks where run_id = $1 order by position",
      [runId],
    );
    expect(tasks).toEqual([
      { position: 3, name: "Order cleaning", section_name: "Before move-in", is_required: false, status: "to_do" },
      { position: 4, name: "Hand over the keys", section_name: "Move-in day", is_required: true, status: "to_do" },
    ]);

    // Email інших користувачів недоступні ні через профілі, ні через вибір виконавця (відмова або порожньо).
    const profiles = await rowsOrNothing(t.asUser<{ email: string }>(V, "select email from public.profiles where id <> $1", [V]));
    expect(profiles).toEqual([]);
    const picker = await rowsOrNothing(t.asUser<{ email: string }>(V, "select email from public.list_assignable_users()"));
    expect(picker).toEqual([]);
  });
});
