import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/runs/domain";
import { apartment12, runsDomain, V } from "./contract";

// AC-VENDOR-05: вендор позначає свою задачу 3 (не остання обов'язкова) — «done» і «Your tasks: 1 of 2 done».
const vendor = { id: V, role: "vendor" } as unknown as Actor;

describe("vendor-access: a vendor marks their task done", () => {
  it('AC-VENDOR-05: after V marks task 3 done, task 3 is "done" and V sees "Your tasks: 1 of 2 done"', () => {
    const res = runsDomain.markTaskDone(apartment12(), "k3", vendor);
    expect(res.ok).toBe(true);
    expect(res.run.tasks.find((k) => k.id === "k3")?.status).toBe("done");
    expect(runsDomain.yourTasksLabel(res.run.tasks, V)).toBe("Your tasks: 1 of 2 done");
  });

  it('AC-VENDOR-05: the label counts done tasks of V only — "0 of 2" before, "2 of 2" when both are done', () => {
    const run = apartment12();
    expect(runsDomain.yourTasksLabel(run.tasks, V)).toBe("Your tasks: 0 of 2 done");
    // Задачі менеджера A «done» не змінюють лічильника V.
    const othersDone = run.tasks.map((k) => (k.assigneeId === V ? k : { ...k, status: "done" as const }));
    expect(runsDomain.yourTasksLabel(othersDone, V)).toBe("Your tasks: 0 of 2 done");
    const allDone = run.tasks.map((k) => ({ ...k, status: "done" as const }));
    expect(runsDomain.yourTasksLabel(allDone, V)).toBe("Your tasks: 2 of 2 done");
  });
});
