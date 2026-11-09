import { describe, expect, it } from "vitest";
import { apartment14, runsDomain, V } from "./contract";

// AC-VENDOR-10: вендор без жодної задачі — повідомлення «No tasks assigned to you yet.» замість порожньої таблиці.
describe("vendor-access: a vendor without tasks", () => {
  it('AC-VENDOR-10: vendor V with no task sees "No tasks assigned to you yet." and no table', () => {
    const rows = runsDomain.vendorRunListRows([apartment14()], V);
    expect(rows).toEqual([]);
    expect(runsDomain.vendorRunsListView(rows.length)).toEqual({ kind: "empty", message: "No tasks assigned to you yet." });
  });

  it("AC-VENDOR-10: with one run of V the list is a table, not the message", () => {
    expect(runsDomain.vendorRunsListView(1)).toEqual({ kind: "table" });
  });
});
