// Контракт зрізу 3 (openspec/specs/vendor-access) для чистих функцій сторінок: назви запропоновано з тексту AC,
// коду ще немає. Імпорт через простір імен і приведення типу: поки функцій немає, typecheck репо лишається зеленим,
// а падають лише тести (TypeError: … is not a function).
import * as runs from "@/lib/runs/domain";
import * as templates from "@/lib/templates/domain";

export type VendorTask = { id: string; name: string; sectionName: string; isRequired: boolean; assigneeId: string; status: runs.TaskStatus };
export type VendorRun = { id: string; caseName: string; templateName: string; runManagerId: string; status: runs.RunStatus; createdAt: string; tasks: VendorTask[] };

export type VendorRunView =
  | { kind: "not_found"; message: string }
  | { kind: "tasks"; tasks: { id: string; name: string; section: string; required: "required" | "optional"; status: string }[] };

type RunsContract = {
  /** «Your tasks: N of K done»: K — задачі userId у запуску, N — ті з них, що «done». */
  yourTasksLabel(tasks: readonly Pick<VendorTask, "assigneeId" | "status">[], userId: string): string;
  /** Список запусків вендора: лише запуски з його задачами; статус запуску й «Your tasks: …». */
  vendorRunListRows(runs: readonly VendorRun[], vendorId: string): { id: string; caseName: string; status: string; yourTasks: string }[];
  /** Сторінка запуску очима вендора: лише його задачі або «Run not found». */
  vendorRunView(run: VendorRun | null, vendorId: string): VendorRunView;
  /** Порожній список запусків вендора — повідомлення без таблиці. */
  vendorRunsListView(rowCount: number): { kind: "empty"; message: string } | { kind: "table" };
};

type TemplatesContract = {
  /** Список шаблонів (/templates): вендору — «Not enough rights», менеджеру й адміністратору — дозволено. */
  templatesListAccess(role: "manager" | "admin" | "vendor"): { kind: "denied"; message: string } | { kind: "allowed" };
};

export const runsDomain = runs as typeof runs & RunsContract;
export const templatesDomain = templates as typeof templates & TemplatesContract;

/** «Apartment 12, move-in»: 5 задач «Tenant move-in»; 1, 2, 5 — менеджеру A, 3 і 4 — вендору V. */
export const A = "manager-a";
export const V = "vendor-v";
export const apartment12 = (): VendorRun => ({
  id: "run-12",
  caseName: "Apartment 12, move-in",
  templateName: "Tenant move-in",
  runManagerId: A,
  status: "in_progress",
  createdAt: "2026-11-02T09:00:00Z",
  tasks: [
    { id: "k1", name: "Sign the lease", sectionName: "Before move-in", isRequired: true, assigneeId: A, status: "to_do" },
    { id: "k2", name: "Collect the deposit", sectionName: "Before move-in", isRequired: true, assigneeId: A, status: "to_do" },
    { id: "k3", name: "Order cleaning", sectionName: "Before move-in", isRequired: false, assigneeId: V, status: "to_do" },
    { id: "k4", name: "Hand over the keys", sectionName: "Move-in day", isRequired: true, assigneeId: V, status: "to_do" },
    { id: "k5", name: "Record meter readings", sectionName: "Move-in day", isRequired: false, assigneeId: A, status: "to_do" },
  ],
});
export const apartment14 = (): VendorRun => ({
  id: "run-14",
  caseName: "Apartment 14, repair",
  templateName: "Tenant move-in",
  runManagerId: A,
  status: "in_progress",
  createdAt: "2026-11-03T09:00:00Z",
  tasks: apartment12().tasks.map((k) => ({ ...k, id: `m${k.id}`, assigneeId: A })),
});
