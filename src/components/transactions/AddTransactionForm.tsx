"use client";

import { useState } from "react";
import { Transaction, Category } from "@/types";
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
import { getMonthKey } from "@/lib/utils";

interface AddTransactionFormProps {
  onSubmit: (tx: Omit<Transaction, "id" | "source" | "categorySource">) => Promise<void>;
  onCancel: () => void;
}

export function AddTransactionForm({ onSubmit, onCancel }: AddTransactionFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Wants");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) return;
    setLoading(true);
    try {
      await onSubmit({
        date,
        description,
        amount: parseFloat(amount),
        type: "expense",
        currency: "EUR",
        category,
        notes: notes || undefined,
        month: getMonthKey(date),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <SelectItem value="Uncategorized">Uncategorized</SelectItem>
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
          {loading ? "Adding…" : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
