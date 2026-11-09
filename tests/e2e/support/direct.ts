// «Напряму, оминаючи сторінки застосунку» (AC-VENDOR-07, AC-VENDOR-09): запит до API бази від імені користувача —
// з його сесією зі storageState (cookie Supabase), публічним ключем і без секретного. Так само міг би зробити сам
// користувач. Значень токенів не друкуємо й не прикладаємо до звіту.
import { readFileSync } from "node:fs";
import type { Browser } from "@playwright/test";

type StorageState = { cookies: { name: string; value: string }[] };

/**
 * Актуальна сесія користувача: відкриваємо застосунок з його stateFile — proxy (src/proxy.ts) оновлює токен, якщо
 * той прострочився, — і беремо cookie з живого контексту, а не з файлу на диску.
 */
export async function freshState(browser: Browser, stateFile: string): Promise<StorageState> {
  const context = await browser.newContext({ storageState: stateFile });
  try {
    const page = await context.newPage();
    await page.goto("/runs");
    return await context.storageState();
  } finally {
    await context.close();
  }
}

/** Адреси синтетичних користувачів прогону (auth.setup.ts; без паролів). */
export function uatUsers(): Record<"uat-manager" | "uat-vendor" | "uat-idle-vendor", string> {
  return JSON.parse(readFileSync("playwright/.auth/uat-users.json", "utf8"));
}

/** access_token сесії з cookie `sb-<ref>-auth-token` (можливо, розбитої на .0, .1 …; значення «base64-…»). */
function accessToken(state: StorageState): string {
  const { cookies } = state;
  const parts = cookies
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const raw = parts.map((c) => c.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8") : raw;
  return (JSON.parse(json) as { access_token: string }).access_token;
}

/** Виклик функції бази (POST /rest/v1/rpc/<fn>) від імені користувача з сесією state → статус і текст відповіді. */
export async function rpcAs(state: StorageState, fn: string, args: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Для запиту напряму потрібні NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken(state)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return { status: response.status, body: await response.text() };
}
