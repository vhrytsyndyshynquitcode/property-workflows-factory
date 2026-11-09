// Спільні дані тестів бази зрізу 3 (openspec/specs/vendor-access, AC-VENDOR-01…10) — не тест, а гарнес.
// Вендора створюємо в самому тесті так само, як createTestDb створює демо-користувачів: користувач Auth
// (supabase_auth_admin) → тригер створює профіль → service_role ставить роль `vendor`. supabase/demo-users.json не чіпаємо.
import type { TestDb } from "./supabase-pglite";

/** «Tenant move-in» із міграції зрізу 1: 2 розділи, 5 задач, 3 обов'язкові; поточна версія — 1. */
export const TEMPLATE = "00000000-0000-4000-8000-000000000001";
export const VENDOR_EMAIL = "vendor-v@example.test";
export const VENDOR_ID = "b0000000-0000-0000-0000-000000000001";

export async function addVendor(t: TestDb, id = VENDOR_ID, email = VENDOR_EMAIL): Promise<string> {
  await t.db.exec("begin; set local role supabase_auth_admin;");
  try {
    await t.db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      { full_name: "Vendor V" },
    ]);
    await t.db.exec("commit; begin; set local role service_role;");
    await t.db.query("update public.profiles set role = 'vendor' where id = $1", [id]);
    await t.db.exec("commit");
  } catch (error) {
    await t.db.exec("rollback").catch(() => {});
    throw error;
  }
  return id;
}

/** id задач поточної версії шаблону в порядку задач запуску (задача 1 … задача 5). */
export async function templateTaskIds(t: TestDb): Promise<string[]> {
  const rows = await t.asService<{ id: string }>(
    `select vt.id
     from public.templates tm
     join public.version_tasks vt on vt.version_id = tm.current_version_id
     join public.version_sections s on s.id = vt.section_id
     where tm.id = $1
     order by s.position, vt.position, vt.id`,
    [TEMPLATE],
  );
  return rows.map((r) => r.id);
}

/** Запуск від імені користувача через public.launch_run; assign — {номер задачі 1…5: id виконавця}. */
export async function launch(t: TestDb, userId: string, caseName: string, assign: Record<number, string> = {}): Promise<string> {
  const ids = await templateTaskIds(t);
  const assignments = Object.fromEntries(Object.entries(assign).map(([n, who]) => [ids[Number(n) - 1], who]));
  const [row] = await t.asUser<{ id: string }>(userId, "select public.launch_run($1, $2, $3::jsonb) as id", [
    TEMPLATE,
    caseName,
    JSON.stringify(assignments),
  ]);
  return row.id;
}

export type RunTaskRow = { position: number; name: string; section_name: string; is_required: boolean; status: string; assignee_id: string };

/** Задачі запуску в обхід RLS — для перевірки результату. */
export const runTasks = (t: TestDb, runId: string) =>
  t.asService<RunTaskRow>(
    "select position, name, section_name, is_required, status, assignee_id from public.run_tasks where run_id = $1 order by position",
    [runId],
  );

/** Рядки або порожньо: відмова (permission denied / NOT_ALLOWED) і порожній результат однаково нічого не розкривають. */
export const rowsOrNothing = <T>(query: Promise<T[]>): Promise<T[]> => query.then((rows) => rows, () => []);
