"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { errorCodeForDb, validateCaseName } from "@/lib/runs/domain";

// Запуск шаблону для випадку (AC-RUN-01, AC-RUN-03..09). Правила дублює функція бази public.launch_run:
// тут — лише щоб показати повідомлення PM без зайвого запиту.
export async function launchRun(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");
  const caseName = String(formData.get("caseName") ?? "");
  const back = (error: string) =>
    redirect(`/runs/new?template=${encodeURIComponent(templateId)}&error=${error}`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const check = validateCaseName(caseName);
  if (!check.ok) back(check.code);

  // Поля assignee:<taskId>; порожнє значення — виконавець за замовчуванням (менеджер запуску).
  const assignments: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("assignee:") && typeof value === "string" && value) {
      assignments[key.slice("assignee:".length)] = value;
    }
  }

  const { data: runId, error } = await supabase.rpc("launch_run", {
    p_template_id: templateId,
    p_case_name: caseName,
    p_assignments: assignments,
  });
  if (error || !runId) back(errorCodeForDb(error?.message));

  revalidatePath("/runs");
  redirect(`/runs/${runId}`);
}

// Позначка «done» (AC-TASK-01..04, AC-TASK-07, AC-TASK-16). Право перевіряє функція бази public.mark_task_done.
// Остання обов'язкова задача — лише з підтвердженням: без confirmed=1 повертаємо на сторінку з підтвердженням.
export async function markTaskDone(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const confirmed = formData.get("confirmed") === "1";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // «Остання обов'язкова» визначає база: вендор бачить лише свої задачі, тож за видимістю це було б хибно.
  if (!confirmed) {
    const { data: isLast } = await supabase.rpc("is_last_required_task", { p_task_id: taskId });
    if (isLast) {
      redirect(`/runs/${runId}?confirm=${encodeURIComponent(taskId)}`);
    }
  }

  const { error } = await supabase.rpc("mark_task_done", { p_task_id: taskId });
  revalidatePath("/runs");
  revalidatePath(`/runs/${runId}`);
  if (error) {
    // Запуск, до якого користувач не належить, він не бачить (AC-TASK-06) — повідомлення AC-TASK-03 показує список.
    redirect(`/runs?error=${errorCodeForDb(error.message)}`);
  }
  redirect(`/runs/${runId}`);
}
