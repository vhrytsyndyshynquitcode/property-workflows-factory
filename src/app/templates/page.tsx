import Link from "next/link";
import { APP_NAV, VENDOR_NAV } from "@/components/app/app-nav";
import { SignOutButton } from "@/components/app/sign-out-button";
import { FlashAlert } from "@/components/app/flash-alert";
import { buttonVariants } from "@/components/ui/button";
import { AppShell, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { showUnpublishedNotice, TEMPLATE_MESSAGES, templateMessageFor, templatesEmptyState, templatesListAccess } from "@/lib/templates/domain";
import { currentUser } from "@/lib/templates/server";

// Список шаблонів (AC-EDITOR-01, AC-EDITOR-02): admin бачить усі, з позначкою «Unpublished changes»; manager — лише
// збережені як версія (RLS templates_select_admin_or_published) і без позначки.
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { error } = await searchParams;
  const message = templateMessageFor(error);
  const { supabase, role } = await currentUser();
  const access = templatesListAccess(role ?? "manager");
  if (access.kind === "denied") {
    // AC-VENDOR-08: вендору — лише повідомлення, дані шаблонів не читаємо.
    return (
      <AppShell nav={VENDOR_NAV} actions={<SignOutButton />}>
        <FlashAlert message={access.message} />
      </AppShell>
    );
  }
  const isAdmin = role === "admin";
  const empty = templatesEmptyState(isAdmin ? "admin" : "manager");

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, has_unpublished_changes, current_version:template_versions!templates_current_version_id_fkey(number)")
    .order("name");

  return (
    <AppShell nav={APP_NAV} actions={<SignOutButton />}>
      <PageHeader
        title="Templates"
        actions={
          isAdmin ? (
            <Link href="/templates/new" className={buttonVariants()}>
              New template
            </Link>
          ) : null
        }
      />
      <FlashAlert message={message} />
      {templates && templates.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Current version</TableHead>
              {isAdmin ? <TableHead>Changes</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id} data-testid="template-row">
                <TableCell>
                  <Link href={`/templates/${t.id}`} className="text-primary underline-offset-4 hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{t.current_version ? t.current_version.number : "—"}</TableCell>
                {isAdmin ? (
                  <TableCell>
                    {showUnpublishedNotice("admin", t.has_unpublished_changes) ? (
                      <StatusBadge tone="draft">{TEMPLATE_MESSAGES.unpublished}</StatusBadge>
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        // AC-EDITOR-17: порожній список — повідомлення замість порожньої таблиці; адміністратору — і дія.
        <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{empty.message}</p>
          {empty.actionHref ? (
            <Link href={empty.actionHref} className={buttonVariants()}>
              {empty.actionLabel}
            </Link>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
