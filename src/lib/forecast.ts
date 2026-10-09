import { roundMoney } from "@/lib/utils";

type Pair = { Needs: number; Wants: number };

/**
 * Where each budget lands by payday at the current pace:
 *   budget − spent so far − bills still due − everyday pace for the days left.
 * Positive = left over, negative = over. Lets the app warn about one budget
 * heading over even when the pooled Safe to spend still looks comfortable.
 */
export function landingByBudget(budget: Pair, spent: Pair, due: Pair, pace: Pair): Pair {
  return {
    Needs: roundMoney(budget.Needs - spent.Needs - due.Needs - pace.Needs),
    Wants: roundMoney(budget.Wants - spent.Wants - due.Wants - pace.Wants),
  };
}
