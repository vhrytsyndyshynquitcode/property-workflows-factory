// Вхід кожної ролі один раз за прогін → playwright/.auth/<role>.json (у .gitignore: там живі cookie сесії).
// Тести ролей беруть стан через test.use({ storageState: "playwright/.auth/<role>.json" }).
// У цьому проєкті запис вимкнено (playwright.config.ts: setup — video, trace і screenshot "off"): тут вводиться пароль.
//
// Змінні з паролями (лише назви; значення — у .env.local локально або в secrets CI, ніколи в коді):
//   DEMO_USER_PASSWORD           — спільний пароль акаунтів із supabase/demo-users.json (npm run users:demo);
//   UAT_PASSWORD_<РОЛЬ>          — необов'язково: окремий пароль для ролі, напр. UAT_PASSWORD_ADMIN.
//
// Джерело: демо-репо курсу, tests/e2e/auth.setup.ts (тег ws8-03-uat). ROLES — ВАШІ: роль → адреса акаунта на проді
// (D0.5, *@example.test). Тут — тестові акаунти property-workflows на проді (ті самі, що в accounts.zip).
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test as setup } from "@playwright/test";
import { createUatUser, hasAdminKey } from "./support/admin";
import { signIn } from "./support/uat";

const ROLES = {
  admin: "pm-admin@example.test",
  manager: "pm-manager@example.test",
} as const;

for (const [role, email] of Object.entries(ROLES)) {
  setup(`вхід: ${role}`, async ({ page }) => {
    const password = process.env[`UAT_PASSWORD_${role.toUpperCase()}`] ?? process.env.DEMO_USER_PASSWORD;
    expect(password, `немає пароля для ролі ${role}: DEMO_USER_PASSWORD або UAT_PASSWORD_${role.toUpperCase()}`).toBeTruthy();
    await signIn(page, email, password!);
    // Головна шаблону показує email того, хто увійшов (data-testid="user-email"). Інша головна — свій локатор.
    await expect(page.getByTestId("user-email")).toHaveText(email);
    await page.context().storageState({ path: `playwright/.auth/${role}.json` });
  });
}

// ── Зріз 3 (вендор): синтетичні користувачі UAT ─────────────────────────────────────────────────────────────────
// Менеджер A і вендор V для сценаріїв, що пишуть у базу (запуск, позначка), і вендор без задач (AC-VENDOR-10):
// uat-<прогін>-…@example.test, пароль випадковий і живе лише в пам'яті цього кроку (без запису й trace). Прибирає їх
// разом із запусками cleanup.teardown.ts. Адреси (без паролів) — у playwright/.auth/uat-users.json (.gitignore).
const UAT_USERS = { "uat-manager": "manager", "uat-vendor": "vendor", "uat-idle-vendor": "vendor" } as const;

if (hasAdminKey()) {
  setup("вхід: синтетичні менеджер і вендори зрізу 3", async ({ browser }) => {
    // Три користувачі й три входи підряд: на повільному проді (до 25 с на вхід) 60 с не вистачало.
    setup.setTimeout(180_000);
    const emails: Record<string, string> = {};
    for (const [key, role] of Object.entries(UAT_USERS)) {
      const user = await createUatUser(key.replace(/^uat-/, ""), role);
      const context = await browser.newContext();
      const page = await context.newPage();
      await signIn(page, user.email, user.password);
      await expect(page.getByTestId("user-role")).toHaveText(role);
      await context.storageState({ path: `playwright/.auth/${key}.json` });
      await context.close();
      emails[key] = user.email;
    }
    mkdirSync("playwright/.auth", { recursive: true });
    writeFileSync("playwright/.auth/uat-users.json", JSON.stringify(emails, null, 2));
  });
}
