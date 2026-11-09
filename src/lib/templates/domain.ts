// Правила зрізу 2 для сторінок шаблонів (openspec/specs/template-editor, openspec/specs/design-system) як чисті
// функції: хто що бачить, тексти дослівно з AC PM, формат дати версії. Права даних перевіряє база
// (міграція 20261026084454_template_versions.sql): ці функції — для сторінок, дій і тестів з AC ID.

export type Role = "manager" | "admin" | "vendor";

/** AC-VENDOR-08: список шаблонів вендору недоступний. */
export function templatesListAccess(role: Role):
  | { kind: "denied"; message: typeof TEMPLATE_MESSAGES.notEnoughRights }
  | { kind: "allowed" } {
  return role === "vendor" ? { kind: "denied", message: TEMPLATE_MESSAGES.notEnoughRights } : { kind: "allowed" };
}

export const TEMPLATE_MESSAGES = {
  notEnoughRights: "Not enough rights",
  backToTemplates: "Back to templates",
  noRequiredTask: "A template needs at least one required task",
  unpublished: "Unpublished changes",
  templateNotFound: "Template not found",
  noTemplatesForManager: "No templates yet. An administrator creates them.",
  noTemplatesForAdmin: "No templates yet. Create a template to start.",
  createTemplate: "Create a template",
  noVersions: "No versions yet. Save the template to create version 1.",
  enterTemplateName: "Enter a template name",
  nameExists: "A template with this name already exists",
  emptySection: "Every section needs at least one task",
  nameRequired: "Every section and task needs a name",
  saveToLaunch: "Save the template to launch it",
  cannotBeUndone: "This cannot be undone",
  failed: "Something went wrong. Try again.",
} as const;

export const versionSavedMessage = (n: number) => `Version ${n} saved`;
export const templateVersionLabel = (n: number) => `Template version ${n}`;

/**
 * AC-DSYS-02, AC-DSYS-03, AC-EDITOR-07, AC-EDITOR-09: доступ до редактора й списку версій.
 * Без входу — сторінка входу; не admin — «Not enough rights» і «Back to templates», без вмісту; admin — дозволено.
 */
export type AdminPageAccess =
  | { kind: "login" }
  | { kind: "denied"; message: typeof TEMPLATE_MESSAGES.notEnoughRights; backLabel: typeof TEMPLATE_MESSAGES.backToTemplates; backHref: "/templates" }
  | { kind: "allowed" };

export function adminPageAccess(role: Role | null | undefined): AdminPageAccess {
  if (!role) return { kind: "login" };
  if (role !== "admin") {
    return {
      kind: "denied",
      message: TEMPLATE_MESSAGES.notEnoughRights,
      backLabel: TEMPLATE_MESSAGES.backToTemplates,
      backHref: "/templates",
    };
  }
  return { kind: "allowed" };
}

/** AC-EDITOR-01, AC-EDITOR-02: позначка «Unpublished changes» — лише адміністратору. */
export function showUnpublishedNotice(role: Role, hasUnpublishedChanges: boolean): boolean {
  return role === "admin" && hasUnpublishedChanges;
}

/** AC-EDITOR-05: дата й час збереження за Києвом у формі DD.MM.YYYY HH:MM. */
export function formatVersionDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

export type VersionRow = { number: number; createdAt: string; authorEmail: string | null };

/** AC-EDITOR-05: список версій — новіші першими, номер, дата Київ, email автора. */
export function versionListRows(rows: readonly VersionRow[]) {
  return [...rows]
    .sort((a, b) => b.number - a.number)
    .map((r) => ({ number: r.number, savedAt: formatVersionDate(r.createdAt), author: r.authorEmail ?? "—" }));
}

/** Помилка бази (функція save_template_version, унікальний індекс назви) → код для searchParams → текст з AC PM. */
const DB_ERRORS = {
  NO_REQUIRED_TASK: "no_required_task", // AC-EDITOR-04
  EMPTY_SECTION: "empty_section", // AC-EDITOR-15
  NAME_REQUIRED: "name_required", // AC-EDITOR-20 — функція збереження (порожня назва розділу в чернетці)
  template_tasks_name_check: "name_required", // AC-EDITOR-20 — обмеження зрізу 1 не пускає порожню назву задачі
  NO_CHANGES: "no_changes", // AC-EDITOR-12
  NOT_ALLOWED: "not_allowed",
  templates_name_unique: "name_exists", // AC-EDITOR-23
} as const;
const MESSAGES_BY_CODE = {
  no_required_task: TEMPLATE_MESSAGES.noRequiredTask,
  empty_section: TEMPLATE_MESSAGES.emptySection,
  name_required: TEMPLATE_MESSAGES.nameRequired,
  name_empty: TEMPLATE_MESSAGES.enterTemplateName,
  name_exists: TEMPLATE_MESSAGES.nameExists,
  not_allowed: TEMPLATE_MESSAGES.notEnoughRights,
  failed: TEMPLATE_MESSAGES.failed,
} as const;
export type TemplateErrorCode = (typeof DB_ERRORS)[keyof typeof DB_ERRORS] | "name_empty" | "failed";

export function templateErrorCodeForDb(message: string | undefined): TemplateErrorCode {
  for (const [marker, code] of Object.entries(DB_ERRORS)) if (message?.includes(marker)) return code;
  return "failed";
}
export function templateMessageFor(code: unknown): string | undefined {
  // no_changes: збереження без змін нічого не робить і не показує помилки (AC-EDITOR-12).
  // Object.hasOwn, не `in`: ?error=__proto__ чи constructor не мають дістатися прототипу.
  return typeof code === "string" && Object.hasOwn(MESSAGES_BY_CODE, code)
    ? MESSAGES_BY_CODE[code as keyof typeof MESSAGES_BY_CODE]
    : undefined;
}

/** AC-EDITOR-17, AC-EDITOR-18: порожні списки — повідомлення замість порожньої таблиці. */
export function templatesEmptyState(role: Role) {
  return role === "admin"
    ? { message: TEMPLATE_MESSAGES.noTemplatesForAdmin, actionLabel: TEMPLATE_MESSAGES.createTemplate, actionHref: "/templates/new" }
    : { message: TEMPLATE_MESSAGES.noTemplatesForManager };
}

/** AC-EDITOR-10: у формі запуску незбережений шаблон адміністратор бачить недоступним з приміткою; менеджер — не бачить. */
export function launchOption(template: { hasVersion: boolean }) {
  return template.hasVersion
    ? { available: true as const }
    : { available: false as const, note: TEMPLATE_MESSAGES.saveToLaunch };
}

/** AC-EDITOR-12: «Save» пропонуємо лише за неопублікованих змін. */
export const canSaveVersion = (hasUnpublishedChanges: boolean) => hasUnpublishedChanges;

/** AC-EDITOR-13, AC-EDITOR-14: що видаляємо після підтвердження (?remove=section:<id> або task:<id>). */
export function removalTarget(value: unknown): { kind: "section" | "task"; id: string } | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(section|task):([0-9a-f-]{36})$/);
  return match ? { kind: match[1] as "section" | "task", id: match[2] } : null;
}

// Переміщення розділу чи задачі на одну позицію: новий порядок 1..n і лише змінені елементи. Порядок — за position,
// при рівних — за id, тож після обірваного запису (дві однакові position) наступне переміщення відновлює послідовність.
export function reorderAfterMove<T extends { id: string; position: number }>(
  items: readonly T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const sorted = [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const i = sorted.findIndex((x) => x.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= sorted.length) return [];
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return sorted.flatMap((x, k) => (x.position === k + 1 ? [] : [{ ...x, position: k + 1 }]));
}
