import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";
import { addVendor, VENDOR_EMAIL } from "./vendor-fixtures";

// AC-VENDOR-02: у виборі виконавця (public.list_assignable_users) менеджер бачить email менеджерів, адміністраторів
// і вендорів — без імен, ролей та інших даних профілів.
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);

describe("vendor-access (db): assignee picker", () => {
  it("AC-VENDOR-02: manager A sees the emails of manager B, the administrator and vendor V, and no names or roles", async () => {
    const A = t.users["member1@example.test"];
    await addVendor(t);

    const rows = await t.asUser<Record<string, unknown>>(A, "select * from public.list_assignable_users()");

    expect(rows.map((r) => r.email)).toEqual(
      expect.arrayContaining(["member2@example.test", "admin@example.test", VENDOR_EMAIL]),
    );
    // Лише id і email: жодних full_name, role чи інших полів профілю.
    expect([...new Set(rows.flatMap((r) => Object.keys(r)))].sort()).toEqual(["email", "id"]);
    expect(JSON.stringify(rows)).not.toContain("Vendor V");
  });
});
