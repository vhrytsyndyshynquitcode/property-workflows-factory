import { describe, expect, it } from "vitest";
import { apartment12, runsDomain, V } from "./contract";

// AC-VENDOR-04: сторінка запуску очима вендора — рівно його задачі (назва, розділ, required/optional, статус),
// без інших задач, email інших користувачів і прогресу всього запуску.
describe("vendor-access: a run seen by a vendor", () => {
  it("AC-VENDOR-04: vendor V sees exactly tasks 3 and 4 with name, section, required mark and status", () => {
    const view = runsDomain.vendorRunView(apartment12(), V);
    expect(view).toEqual({
      kind: "tasks",
      tasks: [
        { id: "k3", name: "Order cleaning", section: "Before move-in", required: "optional", status: "to do" },
        { id: "k4", name: "Hand over the keys", section: "Move-in day", required: "required", status: "to do" },
      ],
    });
  });

  it("AC-VENDOR-04: the view has no tasks 1, 2 and 5, no emails and no progress of the whole run", () => {
    const view = runsDomain.vendorRunView(apartment12(), V);
    const text = JSON.stringify(view);
    for (const name of ["Sign the lease", "Collect the deposit", "Record meter readings"]) expect(text).not.toContain(name);
    expect(text).not.toContain("@example.test");
    expect(text).not.toContain("manager-a");
    expect(text).not.toMatch(/\d+ of 5 done/);
    expect(view).not.toHaveProperty("progress");
  });
});
