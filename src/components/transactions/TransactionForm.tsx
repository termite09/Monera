"use client";

import { useState } from "react";
import { Transaction, Category, TransactionType } from "@/types";
import type { NewTransaction } from "@/hooks/useTransactions";
import { cn, roundMoney, getDisplayCurrency, toDateStr } from "@/lib/utils";
import { BUDGET_CATEGORIES } from "@/config/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";

interface TransactionFormProps {
  onSubmit: (tx: NewTransaction) => Promise<void>;
  onCancel: () => void;
  /** ISO currency code new entries are recorded in. */
  currency: string;
  initialValues?: Partial<Pick<Transaction, "date" | "description" | "amount" | "type" | "category" | "notes">>;
  submitLabel?: string;
}

type Field = "date" | "description" | "amount";

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

/** Add or edit a transaction you entered yourself. */
export function TransactionForm({ onSubmit, onCancel, currency, initialValues, submitLabel = "Add transaction" }: TransactionFormProps) {
  const [date, setDate] = useState(initialValues?.date ?? toDateStr(new Date()));
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [amount, setAmount] = useState(initialValues?.amount != null ? String(initialValues.amount) : "");
  const [type, setType] = useState<TransactionType>(initialValues?.type ?? "expense");
  const [category, setCategory] = useState<Category>(
    initialValues?.category && initialValues.category !== "Uncategorized" ? initialValues.category : "Wants"
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const clearError = (field: Field) => setErrors(({ [field]: _cleared, ...rest }) => rest);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against double-submit: a slow Drive write can otherwise be fired
    // twice (e.g. pressing Enter again before the disabled button re-renders),
    // creating a duplicate transaction.
    if (loading) return;
    const parsedAmount = roundMoney(parseFloat(amount));
    const nextErrors: Partial<Record<Field, string>> = {};
    if (!date) nextErrors.date = "Date is required";
    if (!description.trim()) nextErrors.description = "Description is required";
    if (!amount) nextErrors.amount = "Amount is required";
    else if (isNaN(parsedAmount) || parsedAmount <= 0) nextErrors.amount = "Enter a valid amount greater than 0";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      await onSubmit({
        date,
        description: description.trim(),
        amount: parsedAmount,
        type,
        currency,
        category: type === "income" ? "Uncategorized" : category,
        notes: notes || undefined,
        excluded: false,
      });
    } catch {
      // The app-wide "Couldn't save" message explains it; the form stays open with what was typed.
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (field: Field) =>
    errors[field] && <p id={`tx-${field}-error`} className="text-xs text-destructive">{errors[field]}</p>;
  const errorClass = (field: Field) => errors[field] && "border-destructive focus-visible:ring-destructive";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label asChild><span>Type</span></Label>
        <Segmented
          items={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          label="Type"
          kind="radio"
          className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-secondary"
          itemClassName="h-11 sm:h-9 rounded-md text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5 w-40">
        <Label htmlFor="tx-date">Date <span className="text-muted-foreground" aria-hidden>*</span></Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); clearError("date"); }}
          aria-describedby={errors.date ? "tx-date-error" : undefined}
          className={cn("h-11", errorClass("date"))}
        />
        {fieldError("date")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-description">Description <span className="text-muted-foreground" aria-hidden>*</span></Label>
        <Input
          id="tx-description"
          value={description}
          onChange={(e) => { setDescription(e.target.value); clearError("description"); }}
          placeholder="e.g. Wolt delivery"
          aria-describedby={errors.description ? "tx-description-error" : undefined}
          className={cn("h-11", errorClass("description"))}
        />
        {fieldError("description")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-amount">Amount ({getDisplayCurrency().trim()}) <span className="text-muted-foreground" aria-hidden>*</span></Label>
        <Input
          id="tx-amount"
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); clearError("amount"); }}
          placeholder="0.00"
          inputMode="decimal"
          aria-describedby={errors.amount ? "tx-amount-error" : undefined}
          className={cn("h-11 font-mono tabular-nums", errorClass("amount"))}
        />
        {fieldError("amount")}
      </div>

      {type !== "income" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-category">Category <span className="text-muted-foreground" aria-hidden>*</span></Label>
          <NativeSelect id="tx-category" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="h-11">
            {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-notes">Notes</Label>
        <Input id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="h-11" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
