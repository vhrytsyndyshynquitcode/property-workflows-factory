import { describe, expect, it } from "vitest";
import { apartment12, apartment14, runsDomain, V } from "./contract";

// AC-VENDOR-03: список запусків очима вендора — лише запуск із його задачами, статус запуску й «Your tasks: N of K done».
describe("vendor-access: runs list of a vendor", () => {
  it('AC-VENDOR-03: vendor V sees only "Apartment 12, move-in" with "in progress" and "Your tasks: 0 of 2 done"', () => {
    const rows = runsDomain.vendorRunListRows([apartment12(), apartment14()], V);
    expect(rows).toEqual([
      { id: "run-12", caseName: "Apartment 12, move-in", status: "in progress", yourTasks: "Your tasks: 0 of 2 done" },
    ]);
    expect(JSON.stringify(rows)).not.toContain("Apartment 14, repair");
  });

  it('AC-VENDOR-03: "Your tasks" counts only the 2 tasks of V, not the 5 tasks of the run', () => {
    expect(runsDomain.yourTasksLabel(apartment12().tasks, V)).toBe("Your tasks: 0 of 2 done");
  });
});
