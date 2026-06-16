"use client";

import { useState } from "react";
import { Transaction, Category } from "@/types";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Date" type="date" value={date} onChange={setDate} required />
      <Input label="Description" value={description} onChange={setDescription} placeholder="e.g. Wolt delivery" required />
      <Input label="Amount (€)" type="number" value={amount} onChange={setAmount} placeholder="0.00" required />
      <Select label="Category" value={category} onChange={(v) => setCategory(v as Category)} required>
        <option value="Needs">Needs</option>
        <option value="Wants">Wants</option>
        <option value="Savings">Savings</option>
        <option value="Uncategorized">Uncategorized</option>
      </Select>
      <Input label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Any additional notes" />

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onCancel} fullWidth>Cancel</Button>
        <Button type="submit" disabled={loading} fullWidth>
          {loading ? "Adding..." : "Add Transaction"}
        </Button>
      </div>
    </form>
  );
}
