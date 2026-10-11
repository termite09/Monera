"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    if (kw && !keywords.includes(kw)) onChange([...keywords, kw]);
    setDraft("");
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-lg font-semibold text-foreground"><h3>{label}</h3></CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground max-w-[65ch]">{hint}</p>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1 pr-1 text-sm font-normal">
                {kw}
                <button
                  type="button"
                  onClick={() => onChange(keywords.filter((k) => k !== kw))}
                  className="rounded-full size-11 sm:size-7 -my-3 sm:-my-1 -mr-2 sm:mr-0 flex items-center justify-center hover:bg-background/60"
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
            aria-label={`Add to ${label}`}
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

/** The keyword lists that tell Monera which payments are pay, own transfers and savings moves. Saved by the Basics form. */
export function RecognisingPay({ salary, setSalary, selfTransfer, setSelfTransfer, savingsVault, setSavingsVault }: {
  salary: string[];
  setSalary: (v: string[]) => void;
  selfTransfer: string[];
  setSelfTransfer: (v: string[]) => void;
  savingsVault: string[];
  setSavingsVault: (v: string[]) => void;
}) {
  return (
    <section aria-labelledby="recognising-pay" className="flex flex-col gap-4 pt-2">
      <div>
        <h2 id="recognising-pay" className="text-xl font-semibold tracking-[-0.01em] text-foreground">Recognising your pay</h2>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">So nothing is counted twice.</p>
      </div>

      <KeywordEditor
        label="Pay keywords"
        hint="Words from your pay's description, like your employer's name. Matching payments count as your pay, replacing the expected amount from Basics."
        placeholder="e.g. employer name"
        keywords={salary}
        onChange={setSalary}
      />
      <KeywordEditor
        label="Your own transfers"
        hint="Money moved between your own accounts. Matching transactions are ignored, so they don't count as income or spending."
        placeholder="e.g. your full name"
        keywords={selfTransfer}
        onChange={setSelfTransfer}
      />
      <KeywordEditor
        label="Revolut savings"
        hint="Moving money into a Revolut Savings vault shows up twice: once going out (counted as Savings) and once coming in. Add words from the incoming one so it isn't counted as income."
        placeholder="e.g. eur savings"
        keywords={savingsVault}
        onChange={setSavingsVault}
      />
    </section>
  );
}
