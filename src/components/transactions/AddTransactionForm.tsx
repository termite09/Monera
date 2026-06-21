"use client";

import { useState } from "react";
import { Transaction, Category, TransactionType } from "@/types";
import { cn, roundMoney } from "@/lib/utils";
import { useAppData } from "@/contexts/AppDataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
interface AddTransactionFormProps {
  onSubmit: (tx: Omit<Transaction, "id" | "source" | "categorySource">) => Promise<void>;
  onCancel: () => void;
  initialValues?: Partial<Pick<Transaction, "date" | "description" | "amount" | "type" | "category" | "notes">>;
  submitLabel?: string;
}

export function AddTransactionForm({ onSubmit, onCancel, initialValues, submitLabel }: AddTransactionFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(initialValues?.date ?? today);
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [amount, setAmount] = useState(initialValues?.amount != null ? String(initialValues.amount) : "");
  const [type, setType] = useState<TransactionType>(initialValues?.type ?? "expense");
  const [category, setCategory] = useState<Category>(initialValues?.category ?? "Wants");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { settings } = useAppData();
  const currency = settings.currency ?? "EUR";

  const selectType = (t: TransactionType) => {
    setType(t);
    if (t !== "income") setCategory("Wants");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!date) newErrors.date = "Date is required";
    if (!description.trim()) newErrors.description = "Description is required";
    const parsedAmount = roundMoney(parseFloat(amount));
    if (!amount) newErrors.amount = "Amount is required";
    else if (isNaN(parsedAmount) || parsedAmount <= 0) newErrors.amount = "Enter a valid amount greater than 0";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-secondary">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectType(t)}
              className={cn(
                "h-9 rounded-md text-sm font-medium capitalize transition-colors",
                type === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-date">Date <span className="text-destructive">*</span></Label>
        <Input
          id="tx-date"
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setErrors((prev) => { const n = {...prev}; delete n.date; return n; }); }}
          className={cn("h-11", errors.date && "border-destructive focus-visible:ring-destructive")}
        />
        {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-desc">Description <span className="text-destructive">*</span></Label>
        <Input
          id="tx-desc"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setErrors((prev) => { const n = {...prev}; delete n.description; return n; }); }}
          placeholder="e.g. Wolt delivery"
          className={cn("h-11", errors.description && "border-destructive focus-visible:ring-destructive")}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-amount">Amount ({currency}) <span className="text-destructive">*</span></Label>
        <Input
          id="tx-amount"
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setErrors((prev) => { const n = {...prev}; delete n.amount; return n; }); }}
          placeholder="0.00"
          className={cn("h-11", errors.amount && "border-destructive focus-visible:ring-destructive")}
        />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
      </div>

          
      {type !== "income" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-category">Category <span className="text-destructive">*</span></Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger id="tx-category" className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Needs">Needs</SelectItem>
              <SelectItem value="Wants">Wants</SelectItem>
              <SelectItem value="Savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-notes">Notes</Label>
        <Input id="tx-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className="h-11" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" type="button" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Saving…" : (submitLabel ?? "Add Transaction")}
        </Button>
      </div>
    </form>
  );
}
