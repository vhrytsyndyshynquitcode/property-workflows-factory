import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAV, VENDOR_NAV } from "@/components/app/app-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { FlashAlert } from "@/components/app/flash-alert";
import { buttonVariants } from "@/components/ui/button";
import { AppShell, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messageFor, RUN_STATUS_TONE, runListRows, runsListView, vendorRunListRows, vendorRunsListView, type RunStatus, type TaskStatus } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";

// Список запусків (AC-TASK-06, AC-TASK-09, AC-TASK-13, AC-TASK-14, AC-TASK-17, AC-DSYS-01, AC-DSYS-04). Які запуски
// видно, вирішує RLS (private.can_see_run): менеджер — свої й ті, де він виконавець; адміністратор — усі.
export default async function RunsPage({ searchParams }: PageProps<"/runs">) {
  const { error } = await searchParams;
  const message = messageFor(error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.claims.sub).maybeSingle();
  const { data: runs } = await supabase
    .from("runs")
    .select("id, case_name, template_name, status, created_at, run_manager_id, run_tasks(status, assignee_id)");

  if (profile?.role === "vendor") {
    // AC-VENDOR-03, AC-VENDOR-10: вендор — лише запуски з його задачами; RLS віддає лише його задачі.
    const vendorRows = vendorRunListRows(
      (runs ?? []).map((r) => ({
        id: r.id,
        caseName: r.case_name,
        templateName: r.template_name,
        status: r.status as RunStatus,
        createdAt: r.created_at,
        tasks: r.run_tasks.map((t) => ({ assigneeId: t.assignee_id, status: t.status as TaskStatus })),
      })),
      data.claims.sub,
    );
    const vendorView = vendorRunsListView(vendorRows.length);
    const vendorStatus = new Map((runs ?? []).map((r) => [r.id, r.status as RunStatus]));
    return (
      <AppShell nav={VENDOR_NAV} actions={<SignOutButton />}>
        <PageHeader title="Runs" />
        <FlashAlert message={message} />
        {vendorView.kind === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Your tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorRows.map((row) => (
                <TableRow key={row.id} data-testid="run-row">
                  <TableCell>
                    <Link href={`/runs/${row.id}`} className="text-primary underline-offset-4 hover:underline">
                      {row.caseName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={RUN_STATUS_TONE[vendorStatus.get(row.id) ?? "in_progress"]}>{row.status}</StatusBadge>
                  </TableCell>
                  <TableCell data-testid="run-progress" className="tabular-nums">
                    {row.yourTasks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">{vendorView.message}</p>
          </div>
        )}
      </AppShell>
    );
  }

  const rows = runListRows(
    (runs ?? []).map((r) => ({
      id: r.id,
      caseName: r.case_name,
      templateName: r.template_name,
      status: r.status as RunStatus,
      createdAt: r.created_at,
      tasks: r.run_tasks.map((t) => ({ status: t.status as TaskStatus })),
    })),
  );
  const view = runsListView(rows.length);
  const statusOf = new Map((runs ?? []).map((r) => [r.id, r.status as RunStatus]));

  return (
    <AppShell nav={APP_NAV} actions={<SignOutButton />}>
      <PageHeader
        title="Runs"
        actions={
          view.kind === "table" ? (
            <Link href="/runs/new" className={buttonVariants()}>
              Launch a template
            </Link>
          ) : null
        }
      />
      <FlashAlert message={message} />
      {view.kind === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="hidden sm:table-cell">Template</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-testid="run-row">
                <TableCell>
                  <Link href={`/runs/${row.id}`} className="text-primary underline-offset-4 hover:underline">
                    {row.caseName}
                  </Link>
                  <span className="block text-muted-foreground sm:hidden">{row.templateName}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={RUN_STATUS_TONE[statusOf.get(row.id) ?? "in_progress"]}>{row.status}</StatusBadge>
                </TableCell>
                <TableCell data-testid="run-progress" className="tabular-nums">
                  {row.progress}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{row.templateName}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{view.message}</p>
          <Link href={view.actionHref} className={buttonVariants()}>
            {view.actionLabel}
          </Link>
        </div>
      )}
    </AppShell>
  );
}
