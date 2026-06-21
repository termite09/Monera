"use client";

import { useState } from "react";
import { Transaction, Category, TransactionType } from "@/types";
import { cn } from "@/lib/utils";
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

  const selectType = (t: TransactionType) => {
    setType(t);
    setCategory(t === "income" ? "Needs" : "Wants");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!description || isNaN(parsedAmount) || parsedAmount <= 0 || !date) return;
    setLoading(true);
    try {
      await onSubmit({
        date,
        description,
        amount: parsedAmount,
        type,
        currency: "EUR",
        category,
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
        <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-11" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-desc">Description <span className="text-destructive">*</span></Label>
        <Input id="tx-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Wolt delivery" required className="h-11" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-amount">Amount (€) <span className="text-destructive">*</span></Label>
        <Input id="tx-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required className="h-11" />
      </div>

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
