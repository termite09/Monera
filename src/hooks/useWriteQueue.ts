import { useCallback, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { notifySaveFailed } from "@/lib/notify";

/**
 * Saves to Drive one at a time for the query at `queryKey`, showing each change
 * on screen at once. Two quick changes never save over each other, and a load
 * never lands on top of a change made while it ran.
 */
export function useWriteQueue<T>(queryKey: QueryKey) {
  const qc = useQueryClient();
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Counts changes made on screen, so a load can tell one happened while it ran.
  const changeCount = useRef(0);

  /** Wraps a query's load: reads only once pending saves have landed, and again if a change came in meanwhile. */
  const afterSaves = useCallback(async (load: () => Promise<T>): Promise<T> => {
    for (;;) {
      const seen = changeCount.current;
      await queue.current;
      const loaded = await load();
      if (changeCount.current === seen) return loaded;
    }
  }, []);

  /**
   * Shows a change instantly, then saves it in the queue. When `write` returns
   * what it wrote, that copy is shown once it lands, since it can hold changes
   * made on another device. If the save fails, the data is re-read from Drive
   * (the source of truth) rather than restoring a snapshot that might also undo
   * other changes made meanwhile.
   */
  const save = useCallback(
    (optimistic: (current: T) => T, write: () => Promise<T | void>): Promise<void> => {
      const mine = (changeCount.current += 1);
      qc.setQueryData<T>(queryKey, (old) => (old === undefined ? old : optimistic(old)));
      const run = queue.current.then(write).then((written) => {
        // Unless a newer change is still on its way, which this copy would hide.
        if (written !== undefined && changeCount.current === mine) qc.setQueryData<T>(queryKey, written);
      });
      queue.current = run.catch(() => {});
      return run.catch((err) => {
        qc.invalidateQueries({ queryKey });
        notifySaveFailed();
        throw err;
      });
    },
    [qc, queryKey]
  );

  return { afterSaves, save };
}
