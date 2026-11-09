// UAT зрізу 3 (вендор) на проді: AC-VENDOR-01 … AC-VENDOR-10 (openspec/specs/vendor-access; requirements/39-…).
// Тексти «Тоді» — дослівно з вимоги PM. Дані — лише синтетичні: менеджер A, вендор V і вендор без задач —
// uat-<прогін>-…@example.test (auth.setup.ts), запуски створює менеджер A; прибирання — cleanup.teardown.ts
// (користувачі разом із запусками й задачами, OWNED_ROWS у support/admin.ts). Тому всі тести — @writes.
// Послідовно: AC-VENDOR-01 створює «Apartment 12, move-in», на ньому стоять AC-VENDOR-03 … AC-VENDOR-07, AC-VENDOR-09.
import { expect, test, type Browser, type Page } from "@playwright/test";
import { freshState, rpcAs, uatUsers } from "./support/direct";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.describe.configure({ mode: "serial" });

const STATE = {
  manager: "playwright/.auth/uat-manager.json",
  vendor: "playwright/.auth/uat-vendor.json",
  idle: "playwright/.auth/uat-idle-vendor.json",
} as const;
// «Tenant move-in» — шаблон з міграції 20261020073540_workflow_runs.sql: 5 задач у порядку запуску.
const TENANT_MOVE_IN = "00000000-0000-4000-8000-000000000001";
const TASKS = ["Sign the lease", "Collect the deposit", "Order cleaning", "Hand over the keys", "Record meter readings"];
const RUN_12 = "Apartment 12, move-in";
const RUN_14 = "Apartment 14, repair";

let users: ReturnType<typeof uatUsers>;
let run12Url = "";
let run14Url = "";

const pages: Page[] = [];
async function pageAs(browser: Browser, role: keyof typeof STATE): Promise<Page> {
  const context = await browser.newContext({ storageState: STATE[role] });
  const page = await context.newPage();
  pages.push(page);
  return page;
}
const taskRow = (page: Page, name: string) => page.getByTestId("task-row").filter({ hasText: name });

/** Менеджер A запускає «Tenant move-in» для випадку; assignments — назва задачі → email виконавця. */
async function launchAs(page: Page, caseName: string, assignments: Record<string, string> = {}) {
  await page.goto(`/runs/new?template=${TENANT_MOVE_IN}`);
  await page.getByLabel("Case name").fill(caseName);
  for (const [task, email] of Object.entries(assignments)) {
    await page.getByLabel(task).selectOption({ label: email });
  }
  await page.getByRole("button", { name: "Launch" }).click();
  await page.waitForURL(/\/runs\/[0-9a-f-]{36}$/);
  return page.url();
}

/**
 * Запуски, на яких стоять AC-VENDOR-03 … AC-VENDOR-09: створює AC-VENDOR-01 (і «Apartment 14, repair» — AC-VENDOR-03),
 * а при окремому прогоні (--grep AC-VENDOR-04) — цей помічник: менеджер A запускає їх у власному контексті.
 */
async function ensureRuns(browser: Browser) {
  if (run12Url && run14Url) return;
  const manager = await pageAs(browser, "manager");
  if (!run12Url) run12Url = await launchAs(manager, RUN_12, { [TASKS[2]]: users["uat-vendor"], [TASKS[3]]: users["uat-vendor"] });
  if (!run14Url) run14Url = await launchAs(manager, RUN_14);
}

test.beforeAll(() => {
  users = uatUsers();
});

test.afterEach(async ({ page }) => {
  await attachRuntimeErrors(page);
  for (const p of pages.splice(0)) await p.context().close();
});

test.describe("менеджер A", () => {
  test.use({ storageState: STATE.manager });

  test(
    "AC-VENDOR-01: manager A assigns vendor V to tasks 3 and 4 at launch — tasks 3 and 4 have V, tasks 1, 2 and 5 have A",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-01" } },
    async ({ page }) => {
      await given('manager A, vendor V and the template "Tenant move-in" with 5 tasks', async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-email")).toHaveText(users["uat-manager"]);
      });
      await when(`A launches the template for the case "${RUN_12}" and assigns V as the assignee of tasks 3 and 4`, async () => {
        run12Url = await launchAs(page, RUN_12, { [TASKS[2]]: users["uat-vendor"], [TASKS[3]]: users["uat-vendor"] });
      });
      await thenStep(
        page,
        {
          clause: "tasks 3 and 4 have V as the assignee, and tasks 1, 2 and 5 have A.",
          visible: [
            `the email of V next to "${TASKS[2]}" and "${TASKS[3]}"`,
            `the email of A next to "${TASKS[0]}", "${TASKS[1]}" and "${TASKS[4]}"`,
          ],
        },
        async () => {
          await expect(page.getByTestId("task-row")).toHaveCount(5);
          for (const name of [TASKS[2], TASKS[3]]) await expect(taskRow(page, name)).toContainText(users["uat-vendor"]);
          for (const name of [TASKS[0], TASKS[1], TASKS[4]]) {
            await expect(taskRow(page, name)).toContainText(users["uat-manager"]);
          }
        },
      );
    },
  );

  test(
    "AC-VENDOR-02: manager A opens the assignee picker — the emails of B, of the administrator and of V, and no names or roles",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-02" } },
    async ({ page }) => {
      await given("managers A and B, an administrator and vendor V, and A launching a template", async () => {
        await page.goto(`/runs/new?template=${TENANT_MOVE_IN}`);
      });
      await when("A opens the assignee picker", async () => {
        await page.getByLabel(TASKS[2]).selectOption({ label: users["uat-vendor"] });
      });
      await thenStep(
        page,
        {
          clause: "A sees the emails of B, of the administrator and of V, and no names, roles or other profile data.",
          visible: [`the email of V chosen in the assignee picker of "${TASKS[2]}"`],
          hidden: [
            "the picker lists the emails of manager B (pm-manager@example.test) and of the administrator (pm-admin@example.test)",
            'every option is an email or "Me (run manager)": no names, roles or other profile data',
          ],
        },
        async () => {
          const options = await page
            .getByLabel(TASKS[2])
            .evaluate((select: HTMLSelectElement) => [...select.options].map((o) => o.text));
          expect(options).toEqual(
            expect.arrayContaining(["pm-manager@example.test", "pm-admin@example.test", users["uat-vendor"]]),
          );
          for (const option of options) expect(option).toMatch(/^(Me \(run manager\)|[\w.+-]+@example\.test)$/);
          await expect(page.getByLabel(TASKS[2])).toHaveValue(/[0-9a-f-]{36}/);
        },
      );
    },
  );
});

test.describe("вендор V", () => {
  test.use({ storageState: STATE.vendor });

  test(
    `AC-VENDOR-03: vendor V opens the list of runs — only "${RUN_12}" with its run status and "Your tasks: 0 of 2 done"`,
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-03" } },
    async ({ page, browser }) => {
      await given(`vendor V who is the assignee of 2 tasks in the run "${RUN_12}" and of no task in the run "${RUN_14}"`, async () => {
        await ensureRuns(browser);
      });
      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
      });
      await thenStep(
        page,
        {
          clause: `V sees only the run "${RUN_12}" with its run status and "Your tasks: 0 of 2 done", and does not see "${RUN_14}".`,
          visible: [`one run "${RUN_12}"`, 'the run status "in progress"', '"Your tasks: 0 of 2 done"'],
          hidden: [`no run "${RUN_14}" on the page`],
        },
        async () => {
          const rows = page.getByTestId("run-row");
          await expect(rows).toHaveCount(1);
          await expect(rows).toContainText(RUN_12);
          await expect(rows).toContainText("in progress");
          await expect(rows.getByTestId("run-progress")).toHaveText("Your tasks: 0 of 2 done");
          await expect(page.getByText(RUN_14)).toHaveCount(0);
        },
      );
    },
  );

  test(
    `AC-VENDOR-04: vendor V opens the run "${RUN_12}" — exactly tasks 3 and 4, no other tasks, emails or progress of the run`,
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-04" } },
    async ({ page, browser }) => {
      await given(`vendor V who is the assignee of tasks 3 and 4 in the run "${RUN_12}" (5 tasks)`, async () => {
        await ensureRuns(browser);
      });
      await when("V opens this run", async () => {
        await page.goto(run12Url);
      });
      await thenStep(
        page,
        {
          clause:
            'V sees exactly tasks 3 and 4, each with its name, its section, the mark "required" or "optional" and its status, and does not see tasks 1, 2 and 5, the emails of other users or the progress of the whole run.',
          visible: [
            `"${TASKS[2]}" — section "Before move-in", "optional", "to do"`,
            `"${TASKS[3]}" — section "Move-in day", "required", "to do"`,
          ],
          hidden: [
            `no "${TASKS[0]}", "${TASKS[1]}" or "${TASKS[4]}" on the page`,
            "no email of other users on the page",
            'no progress of the whole run ("N of 5 done")',
          ],
        },
        async () => {
          await expect(page.getByTestId("task-row")).toHaveCount(2);
          await expect(taskRow(page, TASKS[2])).toContainText("Before move-in");
          await expect(taskRow(page, TASKS[2])).toContainText("optional");
          await expect(taskRow(page, TASKS[2]).getByTestId("task-status")).toHaveText("to do");
          await expect(taskRow(page, TASKS[3])).toContainText("Move-in day");
          await expect(taskRow(page, TASKS[3])).toContainText("required");
          await expect(taskRow(page, TASKS[3]).getByTestId("task-status")).toHaveText("to do");
          for (const name of [TASKS[0], TASKS[1], TASKS[4]]) await expect(page.getByText(name)).toHaveCount(0);
          const body = await page.locator("body").innerText();
          expect(body.match(/[\w.+-]+@example\.test/g) ?? []).toEqual([]);
          expect(body).not.toMatch(/\d+ of 5 done/);
        },
      );
    },
  );

  test(
    'AC-VENDOR-05: vendor V marks task 3 as done — task 3 has status "done", and V sees "Your tasks: 1 of 2 done"',
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-05" } },
    async ({ page, browser }) => {
      await given(`vendor V who is the assignee of task 3 with status "to do", which is not the last required task of the run "${RUN_12}"`, async () => {
        await ensureRuns(browser);
        await page.goto(run12Url);
        await expect(taskRow(page, TASKS[2]).getByTestId("task-status")).toHaveText("to do");
      });
      await when("V marks task 3 as done", async () => {
        await taskRow(page, TASKS[2]).getByRole("button", { name: "Mark as done" }).click();
        await expect(taskRow(page, TASKS[2]).getByTestId("task-status")).toHaveText("done");
      });
      await thenStep(
        page,
        {
          clause: 'task 3 has status "done", and V sees "Your tasks: 1 of 2 done".',
          visible: [`"${TASKS[2]}" with status "done"`, '"Your tasks: 1 of 2 done"'],
        },
        async () => {
          await expect(taskRow(page, TASKS[2]).getByTestId("task-status")).toHaveText("done");
          await expect(page.getByTestId("your-tasks")).toHaveText("Your tasks: 1 of 2 done");
          await expect(page.getByRole("alertdialog")).toHaveCount(0);
        },
      );
    },
  );

  test(
    `AC-VENDOR-06: vendor V opens the run "${RUN_14}" by a direct link — "Run not found" and none of its tasks`,
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-06" } },
    async ({ page, browser }) => {
      await given(`the run "${RUN_14}" in which vendor V has no task`, async () => {
        await ensureRuns(browser);
      });
      await when("V opens the page of this run by a direct link", async () => {
        await page.goto(run14Url);
      });
      await thenStep(
        page,
        {
          clause: 'V sees the message "Run not found" and none of the tasks of the run.',
          visible: ['the message "Run not found"'],
          hidden: ["no task of the run on the page", `no case name "${RUN_14}"`],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("alert")).toHaveText("Run not found");
          await expect(page.getByTestId("task-row")).toHaveCount(0);
          for (const name of TASKS) await expect(page.getByText(name)).toHaveCount(0);
          await expect(page.getByText(RUN_14)).toHaveCount(0);
        },
      );
    },
  );

  test(
    'AC-VENDOR-08: vendor V opens the list of templates by a direct link — "Not enough rights" and no template',
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-08" } },
    async ({ page }) => {
      await given("vendor V signed in", async () => {
        await page.goto("/");
        await expect(page.getByTestId("user-role")).toHaveText("vendor");
      });
      await when("V opens the list of templates by a direct link", async () => {
        await page.goto("/templates");
      });
      await thenStep(
        page,
        {
          clause: 'V sees the message "Not enough rights" and no template.',
          visible: ['the message "Not enough rights"'],
          hidden: ['no template on the page (no "Tenant move-in", no table of templates)'],
        },
        async () => {
          await expect(page.getByRole("main").getByRole("alert")).toHaveText("Not enough rights");
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.getByText("Tenant move-in")).toHaveCount(0);
        },
      );
    },
  );

  test(
    "AC-VENDOR-09: vendor V launches the template directly, bypassing the pages — no run is created and the list of runs does not change",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-09" } },
    async ({ page, browser }) => {
      let before: string[] = [];
      let response = { status: 0, body: "" };
      await given('vendor V signed in and the template "Tenant move-in" with current version 1', async () => {
        await ensureRuns(browser);
        await page.goto("/runs");
        before = await page.getByTestId("run-row").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""));
      });
      await when("V tries to launch this template directly, bypassing the pages of the application", async () => {
        response = await rpcAs(await freshState(browser, STATE.vendor), "launch_run", {
          p_template_id: TENANT_MOVE_IN,
          p_case_name: "Apartment 20, move-in",
          p_assignments: {},
        });
      });
      await thenStep(
        page,
        {
          clause: "no run is created, and the list of runs does not change.",
          visible: [`the list of runs of V with the same single run "${RUN_12}"`],
          hidden: ["the direct request of V was refused (not allowed)", 'no run "Apartment 20, move-in"'],
        },
        async () => {
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.body).toContain("NOT_ALLOWED");
          await page.reload();
          await expect(page.getByTestId("run-row")).toHaveCount(before.length);
          expect(await page.getByTestId("run-row").evaluateAll((rows) => rows.map((r) => r.textContent ?? ""))).toEqual(before);
          await expect(page.getByText("Apartment 20, move-in")).toHaveCount(0);
        },
      );
    },
  );
});

test.describe("менеджер A після запиту вендора напряму", () => {
  test.use({ storageState: STATE.manager });

  test(
    'AC-VENDOR-07: vendor V marks task 1 of manager A directly, bypassing the pages — task 1 stays "to do"',
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-07" } },
    async ({ page: manager, browser }) => {
      let task1 = "";
      let response = { status: 0, body: "" };
      await given(`the run "${RUN_12}" in which task 1 is assigned to manager A and tasks 3 and 4 to vendor V`, async () => {
        await ensureRuns(browser);
        await manager.goto(run12Url);
        task1 = await taskRow(manager, TASKS[0]).locator('input[name="taskId"]').first().inputValue();
      });
      await when("V tries to mark task 1 as done directly, bypassing the pages of the application", async () => {
        response = await rpcAs(await freshState(browser, STATE.vendor), "mark_task_done", { p_task_id: task1 });
      });
      await thenStep(
        manager,
        {
          clause: 'task 1 stays "to do".',
          visible: [`"${TASKS[0]}" with status "to do" on the run page of manager A`],
          hidden: ["the direct request of V was refused (not allowed)"],
        },
        async () => {
          expect(response.status).toBeGreaterThanOrEqual(400);
          expect(response.body).toContain("NOT_ALLOWED");
          await manager.reload();
          await expect(taskRow(manager, TASKS[0]).getByTestId("task-status")).toHaveText("to do");
        },
      );
    },
  );
});

test.describe("вендор без задач", () => {
  test.use({ storageState: STATE.idle });

  test(
    'AC-VENDOR-10: vendor V with no task opens the list of runs — "No tasks assigned to you yet." and no empty table',
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-VENDOR-10" } },
    async ({ page }) => {
      await given("vendor V to whom no task is assigned", async () => {});
      await when("V opens the list of runs", async () => {
        await page.goto("/runs");
      });
      await thenStep(
        page,
        {
          clause: 'V sees the message "No tasks assigned to you yet." and no empty table.',
          visible: ['the message "No tasks assigned to you yet."'],
          hidden: ["no table on the page"],
        },
        async () => {
          await expect(page.getByText("No tasks assigned to you yet.", { exact: true })).toBeVisible();
          await expect(page.getByRole("table")).toHaveCount(0);
        },
      );
    },
  );
});
