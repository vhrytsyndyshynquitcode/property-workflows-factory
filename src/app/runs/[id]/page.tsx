import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAV, VENDOR_NAV } from "@/components/app/app-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import {
  assigneeLabel,
  canMarkDone,
  CONFIRM_NOTICE,
  groupBySection,
  progressLabel,
  requiredLabel,
  RUN_NOT_FOUND,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  vendorRunView,
  type RunStatus,
  type TaskStatus,
} from "@/lib/runs/domain";
import { templateVersionLabel, type Role } from "@/lib/templates/domain";
import { MarkDoneForm } from "@/components/app/mark-done-form";
import { markTaskDone } from "../actions";

// Сторінка запуску: прогрес і статус кожної задачі (AC-TASK-05, AC-TASK-08, AC-DSYS-01), задачі за розділами на момент
// запуску (AC-TASK-12, AC-RUN-12), позначка required/optional (AC-TASK-15), email виконавця (AC-TASK-11), «Mark as done»
// лише на задачах, які користувач може позначити (AC-TASK-18), підтвердження останньої обов'язкової (AC-TASK-04,
// AC-TASK-16). Запуск, якого користувач не бачить за RLS, — «Run not found» (AC-TASK-10).
export default async function RunPage({ params, searchParams }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const { confirm } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: run } = await supabase
    .from("runs")
    .select("id, case_name, template_name, status, run_manager_id, template_version:template_versions(number), run_tasks(id, name, section_name, is_required, position, assignee_id, status)")
    .eq("id", id)
    .maybeSingle();

  if (!run) {
    return (
      <AppShell nav={APP_NAV} actions={<SignOutButton />}>
        <Alert>
          <AlertTitle>{RUN_NOT_FOUND}</AlertTitle>
        </Alert>
        <Link href="/runs" className="text-sm text-primary underline-offset-4 hover:underline">
          All runs
        </Link>
      </AppShell>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", claims.sub).maybeSingle();
  const actor = { id: claims.sub, role: (profile?.role ?? "manager") as Role };

  if (actor.role === "vendor") {
    // AC-VENDOR-04, AC-VENDOR-05, AC-VENDOR-06: лише власні задачі; без email, менеджера й прогресу запуску.
    const view = vendorRunView(
      {
        id: run.id,
        tasks: run.run_tasks.map((t) => ({
          id: t.id,
          name: t.name,
          sectionName: t.section_name,
          isRequired: t.is_required,
          assigneeId: t.assignee_id,
          status: t.status as TaskStatus,
        })),
      },
      actor.id,
    );
    const statusOf = new Map(run.run_tasks.map((t) => [t.id, t.status as TaskStatus]));
    const positions = new Map(run.run_tasks.map((t) => [t.id, t.position]));
    return (
      <AppShell nav={VENDOR_NAV} actions={<SignOutButton />}>
        {view.kind === "not_found" ? (
          <Alert>
            <AlertTitle>{view.message}</AlertTitle>
          </Alert>
        ) : (
          <>
            <PageHeader title={run.case_name} description={run.template_name} />
            <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd data-testid="run-status">
                <StatusBadge tone={RUN_STATUS_TONE[run.status as RunStatus]}>{RUN_STATUS_LABEL[run.status as RunStatus]}</StatusBadge>
              </dd>
            </dl>
            {groupBySection(
              [...view.tasks]
                .sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0))
                .map((t) => ({ ...t, sectionName: t.section })),
            ).map((group) => (
              <Card key={group.section}>
                <CardContent className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">{group.section}</h2>
                  <ul className="flex flex-col divide-y divide-border">
                    {group.tasks.map((task) => {
                      const status = statusOf.get(task.id) ?? "to_do";
                      return (
                        <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm" data-testid="task-row">
                          <span>{task.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{task.required}</span>
                            <span data-testid="task-status">
                              <StatusBadge tone={TASK_STATUS_TONE[status]}>{task.status}</StatusBadge>
                            </span>
                            {status === "to_do" ? (
                              <MarkDoneForm runId={run.id} taskId={task.id} confirmed />
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </>
        )}
        <Link href="/runs" className="text-sm text-primary underline-offset-4 hover:underline">
          All runs
        </Link>
      </AppShell>
    );
  }

  const { data: users } = await supabase.rpc("list_assignable_users");

  const tasks = [...run.run_tasks]
    .sort((a, b) => a.position - b.position)
    .map((t) => ({ ...t, sectionName: t.section_name, status: t.status as TaskStatus }));
  const confirmTask = typeof confirm === "string" ? tasks.find((t) => t.id === confirm && t.status === "to_do") : undefined;
  const runStatus = run.status as RunStatus;

  return (
    <AppShell nav={APP_NAV} actions={<SignOutButton />}>
      <PageHeader
        title={run.case_name}
        description={`${run.template_name}${run.template_version ? ` · ${templateVersionLabel(run.template_version.number)}` : ""} · run manager: ${assigneeLabel(users ?? [], run.run_manager_id)}`}
      />
      <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd data-testid="run-status">
          <StatusBadge tone={RUN_STATUS_TONE[runStatus]}>{RUN_STATUS_LABEL[runStatus]}</StatusBadge>
        </dd>
        <dt className="text-muted-foreground">Progress</dt>
        <dd data-testid="run-progress" className="tabular-nums">
          {progressLabel(tasks)}
        </dd>
      </dl>
      {confirmTask ? (
        <Alert role="alertdialog" aria-labelledby="confirm-title">
          <AlertTitle id="confirm-title">{confirmTask.name}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>{CONFIRM_NOTICE}</p>
            <div className="flex gap-3">
              <form action={markTaskDone}>
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="taskId" value={confirmTask.id} />
                <input type="hidden" name="confirmed" value="1" />
                <Button type="submit" variant="destructive">
                  Confirm
                </Button>
              </form>
              <Link href={`/runs/${run.id}`} className={buttonVariants({ variant: "outline" })}>
                Cancel
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {groupBySection(tasks).map((group) => (
        <Card key={group.section}>
          <CardContent className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">{group.section}</h2>
            <ul className="flex flex-col divide-y divide-border">
              {group.tasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm" data-testid="task-row">
                  <div className="flex flex-col">
                    <span>{task.name}</span>
                    <span className="text-muted-foreground">{assigneeLabel(users ?? [], task.assignee_id)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{requiredLabel(task.is_required)}</span>
                    <span data-testid="task-status">
                      <StatusBadge tone={TASK_STATUS_TONE[task.status]}>{TASK_STATUS_LABEL[task.status]}</StatusBadge>
                    </span>
                    {task.status === "to_do" &&
                    canMarkDone(actor, { runManagerId: run.run_manager_id }, { assigneeId: task.assignee_id }) ? (
                      <MarkDoneForm runId={run.id} taskId={task.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      <Link href="/runs" className="text-sm text-primary underline-offset-4 hover:underline">
        All runs
      </Link>
    </AppShell>
  );
}
