import { describe, expect, it } from "vitest";
import { templatesDomain } from "./contract";

// AC-VENDOR-08: список шаблонів за прямим посиланням — вендору «Not enough rights» і жодного шаблону.
describe("vendor-access: templates list for a vendor", () => {
  it('AC-VENDOR-08: vendor V opening the templates list sees "Not enough rights"', () => {
    expect(templatesDomain.templatesListAccess("vendor")).toEqual({ kind: "denied", message: "Not enough rights" });
  });

  it("AC-VENDOR-08: managers and administrators still open the templates list", () => {
    expect(templatesDomain.templatesListAccess("manager")).toEqual({ kind: "allowed" });
    expect(templatesDomain.templatesListAccess("admin")).toEqual({ kind: "allowed" });
  });
});
