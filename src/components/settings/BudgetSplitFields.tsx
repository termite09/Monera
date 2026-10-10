import { Fragment } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Needs / Wants / Savings percentages as typed (strings, so a field can be empty mid-edit). */
export interface SplitDraft {
  needs: string;
  wants: string;
  savings: string;
}

export const toSplitDraft = (rule: { needs: number; wants: number; savings: number }): SplitDraft => ({
  needs: String(rule.needs),
  wants: String(rule.wants),
  savings: String(rule.savings),
});

export const fromSplitDraft = (d: SplitDraft) => ({
  needs: parseFloat(d.needs) || 0,
  wants: parseFloat(d.wants) || 0,
  savings: parseFloat(d.savings) || 0,
});

export const splitTotal = (d: SplitDraft) => {
  const s = fromSplitDraft(d);
  return s.needs + s.wants + s.savings;
};

const ROWS = [
  { key: "needs", label: "Needs", hint: "rent, groceries, bills, transport", placeholder: "50" },
  { key: "wants", label: "Wants", hint: "eating out, shopping, subscriptions", placeholder: "30" },
  { key: "savings", label: "Savings", hint: "money you put aside or invest", placeholder: "20" },
] as const;

/** The three percentage fields and their running total. */
export function BudgetSplitFields({ idPrefix, value, onChange, showHints = false }: {
  idPrefix: string;
  value: SplitDraft;
  onChange: (next: SplitDraft) => void;
  showHints?: boolean;
}) {
  const total = splitTotal(value);
  return (
    <>
      {ROWS.map(({ key, label, hint, placeholder }, i) => (
        <Fragment key={key}>
          {i > 0 && <Separator />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-${key}`}>
              {label} %{showHints && <span className="font-normal text-muted-foreground"> · {hint}</span>}
            </Label>
            <Input
              id={`${idPrefix}-${key}`}
              type="number"
              inputMode="decimal"
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              placeholder={placeholder}
              className="h-11 max-w-28"
            />
          </div>
        </Fragment>
      ))}
      <p className="text-xs text-muted-foreground max-w-[65ch]" aria-live="polite">
        Adds up to <span className={cn("font-mono tabular-nums font-medium", total !== 100 ? "text-destructive" : "text-foreground")}>{total}%</span>
        {total !== 100 && <span className="text-destructive">. It needs to be 100%.</span>}
      </p>
    </>
  );
}
