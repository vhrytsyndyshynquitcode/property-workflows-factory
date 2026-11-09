import { Button } from "@/components/ui/button";
import { markTaskDone } from "@/app/runs/actions";

// Форма «Mark as done» для однієї задачі; `confirmed` пропускає крок підтвердження (вендор, AC-VENDOR-06).
export function MarkDoneForm({ runId, taskId, confirmed = false }: { runId: string; taskId: string; confirmed?: boolean }) {
  return (
    <form action={markTaskDone}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="taskId" value={taskId} />
      {confirmed ? <input type="hidden" name="confirmed" value="1" /> : null}
      <Button type="submit" variant="outline" size="sm">
        Mark as done
      </Button>
    </form>
  );
}
