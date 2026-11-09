import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, launch, TEMPLATE } from "./vendor-fixtures";

// AC-VENDOR-09: вендор не запускає шаблон і напряму (public.launch_run); список запусків не змінюється.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

const allRuns = () => t.asService<{ id: string; case_name: string }>("select id, case_name from public.runs order by id");

describe("vendor-access (db): a vendor cannot launch a template", () => {
  it('AC-VENDOR-09: vendor V launches "Tenant move-in" (version 1) directly; no run is created and the runs list is unchanged', async () => {
    const A = t.users["member1@example.test"];
    const V = await addVendor(t);
    const [version] = await t.asService<{ number: number }>(
      "select v.number from public.templates tm join public.template_versions v on v.id = tm.current_version_id where tm.id = $1",
      [TEMPLATE],
    );
    expect(version.number).toBe(1);
    await launch(t, A, "Apartment 12, move-in", { 3: V, 4: V });
    const before = await allRuns();
    expect(before).toHaveLength(1);

    await expect(
      t.asUser(V, "select public.launch_run($1, $2, '{}'::jsonb)", [TEMPLATE, "Apartment 15, move-in"]),
    ).rejects.toThrow(/NOT_ALLOWED/);
    await expect(
      t.asUser(
        V,
        "insert into public.runs (template_name, case_name, run_manager_id) values ('Tenant move-in', 'Apartment 15, move-in', $1)",
        [V],
      ),
    ).rejects.toThrow(/permission denied/);

    expect(await allRuns()).toEqual(before);
  });
});
