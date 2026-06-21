"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/contexts/AppDataContext";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

function KeywordEditor({ label, hint, placeholder, keywords, onChange }: {
  label: string;
  hint: string;
  placeholder: string;
  keywords: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const kw = draft.trim().toLowerCase();
    if (!kw || keywords.includes(kw)) {
      setDraft("");
      return;
    }
    onChange([...keywords, kw]);
    setDraft("");
  };

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1 pr-1 text-sm font-normal">
                {kw}
                <button
                  onClick={() => onChange(keywords.filter((k) => k !== kw))}
                  className="rounded-full p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${kw}`}
                >
                  <X size={13} />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="h-11"
          />
          <Button onClick={add} variant="outline" className="shrink-0">
            <Plus size={16} className="mr-1.5" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IncomeForm({ settings, updateSettings }: {
  settings: ReturnType<typeof useAppData>["settings"];
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const [salary, setSalary] = useState<string[]>(settings.salaryKeywords ?? []);
  const [selfTransfer, setSelfTransfer] = useState<string[]>(settings.selfTransferKeywords ?? []);
  const [savingsVault, setSavingsVault] = useState<string[]>(settings.savingsVaultKeywords ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Intentional sync from externally-loaded settings.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSalary(settings.salaryKeywords ?? []);
    setSelfTransfer(settings.selfTransferKeywords ?? []);
    setSavingsVault(settings.savingsVaultKeywords ?? []);
  }, [settings]);

  const dirty =
    JSON.stringify(salary) !== JSON.stringify(settings.salaryKeywords ?? []) ||
    JSON.stringify(selfTransfer) !== JSON.stringify(settings.selfTransferKeywords ?? []) ||
    JSON.stringify(savingsVault) !== JSON.stringify(settings.savingsVaultKeywords ?? []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(false);
    try {
      await updateSettings({
        ...settings,
        salaryKeywords: salary,
        selfTransferKeywords: selfTransfer,
        savingsVaultKeywords: savingsVault,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sources</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Teach Monera which deposits are your salary and which are transfers between your own accounts, so they&apos;re handled correctly.
        </p>
        <p className="text-xs text-muted-foreground mt-2">Your default salary amount is in the <strong>Setup</strong> tab.</p>
      </div>

      <KeywordEditor
        label="Salary keywords"
        hint="If a deposit description contains one of these words, it will be labelled 'Salary' in your income breakdown. Add your employer's name or the text that appears on your payslip."
        placeholder="e.g. employer name"
        keywords={salary}
        onChange={setSalary}
      />
      <KeywordEditor
        label="Internal transfer keywords"
        hint="Transfers between your own accounts (for example, moving money to a savings account). These are removed entirely so they don't show up as income or spending."
        placeholder="e.g. your full name"
        keywords={selfTransfer}
        onChange={setSelfTransfer}
      />
      <KeywordEditor
        label="Revolut savings keywords"
        hint="When you move money into a Revolut Savings Vault, it appears twice — once as an outgoing (counted as Savings) and once as an incoming. Add keywords from those incoming descriptions here to remove the duplicate."
        placeholder="e.g. eur savings"
        keywords={savingsVault}
        onChange={setSavingsVault}
      />

      <Button onClick={handleSave} disabled={isSaving || !dirty} className={cn("w-full", error ? "bg-destructive text-white" : "bg-primary text-primary-foreground")}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Income Settings"}
      </Button>
    </div>
  );
}
