import { describe, expect, it } from "vitest";
import { apartment14, runsDomain, V } from "./contract";

// AC-VENDOR-06: запуск без задач вендора за прямим посиланням — «Run not found» і жодної задачі.
describe("vendor-access: a run without the vendor's tasks", () => {
  it('AC-VENDOR-06: vendor V opening "Apartment 14, repair" by a direct link sees "Run not found" and no task', () => {
    const view = runsDomain.vendorRunView(apartment14(), V);
    expect(view).toEqual({ kind: "not_found", message: "Run not found" });
    expect(JSON.stringify(view)).not.toContain("Sign the lease");
  });

  it('AC-VENDOR-06: a run the database did not return (RLS) is also "Run not found"', () => {
    expect(runsDomain.vendorRunView(null, V)).toEqual({ kind: "not_found", message: "Run not found" });
  });
});
