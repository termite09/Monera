import { useMemo } from "react";
import { Transaction, Settings } from "@/types";
import { computeBudget } from "@/lib/budget";

/** computeBudget, recomputed only when its inputs change. */
export function useBudget(transactions: Transaction[], settings: Settings, periodKey: string) {
  return useMemo(() => computeBudget(transactions, settings, periodKey), [transactions, settings, periodKey]);
}
