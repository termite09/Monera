"use client";

import { useRef, useState } from "react";
import { Check, Upload, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { uploadCSV } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { readSpreadsheetAsCsv, csvFileName } from "@/lib/spreadsheet";
import { cn } from "@/lib/utils";
import { RevolutExportHelp } from "@/components/onboarding/RevolutExportHelp";

function StepBadge({ done, n }: { done: boolean; n: number }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center size-7 rounded-full text-xs font-semibold shrink-0",
        done ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground"
      )}
    >
      {done ? <Check size={15} /> : n}
    </span>
  );
}

export function Onboarding() {
  const { structure, settings, transactions, updateSettings, refetch } = useAppData();
  const { accessToken } = useAuth();

  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  const [payday, setPayday] = useState(String(settings.paydayOfMonth ?? 1));
  const [salary, setSalary] = useState(settings.defaultIncome ? String(settings.defaultIncome) : "");
  const [split, setSplit] = useState(settings.defaultBudgetRule ?? { needs: 50, wants: 30, savings: 20 });
  const [finishing, setFinishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploaded = uploadState === "done" || transactions.length > 0;
  const splitTotal = split.needs + split.wants + split.savings;
  const splitValid = splitTotal === 100;

  const handleFile = async (file?: File | null) => {
    if (!file || !accessToken || !structure) return;
    setUploadState("uploading");
    setUploadMsg("");
    try {
      const content = await readSpreadsheetAsCsv(file);
      const { transactions: parsed, errors } = parseCSV(content);
      await uploadCSV(accessToken, csvFileName(file.name), structure.revolutExportsId, content);
      setUploadState("done");
      setUploadMsg(`Found ${parsed.length} transaction${parsed.length === 1 ? "" : "s"}${errors.length ? ` — ${errors.length} rows skipped (unrecognised format)` : ""}.`);
      refetch();
    } catch (err) {
      setUploadState("error");
      setUploadMsg(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const finish = async () => {
    if (!splitValid) return;
    setFinishing(true);
    const day = Math.min(28, Math.max(1, parseInt(payday) || 1));
    const income = Math.max(0, parseFloat(salary) || 0);
    try {
      // Persist payday, standing salary, budget split, and mark onboarding
      // complete in one write.
      await updateSettings({
        ...settings,
        paydayOfMonth: day,
        defaultIncome: income,
        defaultBudgetRule: split,
        onboarded: true,
      });
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col gap-6 pt-10">
      <div className="text-center">
        <h1 className="text-3xl font-serif text-foreground">Welcome to Monera</h1>
        <p className="text-sm text-muted-foreground mt-1">A few quick steps and you&apos;re set up.</p>
      </div>

      <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardContent className="p-5 flex flex-col gap-5">
          {/* Step 1 — Drive (already done by signing in) */}
          <div className="flex items-start gap-3">
            <StepBadge done n={1} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Google Drive connected</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your data is stored in a private Monera folder in your Drive.</p>
            </div>
          </div>

          {/* Step 2 — Upload */}
          <div className="flex items-start gap-3">
            <StepBadge done={uploaded} n={2} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Upload your first statement</p>
              <p className="text-xs text-muted-foreground mt-0.5">Export a CSV or Excel file from Revolut, then add it here. Takes ~2 minutes — once per pay period is enough.</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {uploaded ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check size={13} /> {uploadMsg || "Statement uploaded."}
                </p>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="mt-2"
                    disabled={uploadState === "uploading"}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploadState === "uploading" ? (
                      <><Loader2 size={15} className="mr-1.5 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload size={15} className="mr-1.5" /> Choose file (CSV or Excel)</>
                    )}
                  </Button>
                  {uploadState === "error" && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle size={13} /> {uploadMsg}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Don&apos;t have one yet?{" "}
                    <span className="text-muted-foreground/60">Skip for now — you can upload from the Upload tab later.</span>
                  </p>
                  <RevolutExportHelp />
                </>
              )}
            </div>
          </div>

          {/* Step 3 — Payday */}
          <div className="flex items-start gap-3">
            <StepBadge done={false} n={3} />
            <div className="min-w-0 flex-1">
              <Label htmlFor="ob-payday" className="text-sm font-medium text-foreground">When do you get paid?</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Day of the month (1–28) — your budget periods run from one payday to the next. Enter 28 if you&apos;re paid on the 29th, 30th, or 31st.</p>
              <Input
                id="ob-payday"
                type="number"
                min={1}
                max={28}
                placeholder="e.g. 24"
                value={payday}
                onChange={(e) => setPayday(e.target.value)}
                className="mt-2 h-11 w-28"
              />
              {parseInt(payday) > 28 && (
                <p className="mt-1 text-xs text-muted-foreground">We cap at 28 to handle all months reliably — your budget will start on the 28th.</p>
              )}
            </div>
          </div>

          {/* Step 4 — Salary */}
          <div className="flex items-start gap-3">
            <StepBadge done={false} n={4} />
            <div className="min-w-0 flex-1">
              <Label htmlFor="ob-salary" className="text-sm font-medium text-foreground">What&apos;s your monthly salary?</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Used as your income each period. Leave it blank and Monera will use the largest single credit in your statement as your income. You can override this for any period later.</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-sm text-muted-foreground font-mono">{settings.currency ?? "EUR"}</span>
                <Input
                  id="ob-salary"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  placeholder="e.g. 2000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="h-11 w-36"
                />
              </div>
            </div>
          </div>

          {/* Step 5 — Budget split */}
          <div className="flex items-start gap-3">
            <StepBadge done={splitValid} n={5} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">How do you want to split your budget?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Percent of income for each category. Must add up to 100%.</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["needs", "wants", "savings"] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <Label htmlFor={`ob-${k}`} className="text-xs capitalize text-muted-foreground">{k}</Label>
                    <div className="relative">
                      <Input
                        id={`ob-${k}`}
                        type="number"
                        min={0}
                        max={100}
                        value={String(split[k])}
                        onChange={(e) => setSplit((s) => ({ ...s, [k]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                        className="h-11 pr-6"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className={cn("text-xs mt-1.5", splitValid ? "text-muted-foreground" : "text-destructive")}>
                {splitValid ? "Adds up to 100%." : `Currently ${splitTotal}% — adjust to total 100%.`}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground/70">
                <span>Rent, groceries, transport</span>
                <span>Eating out, subscriptions</span>
                <span>Savings transfers, investments</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground/60">The 50/30/20 rule is a popular starting point — adjust to fit your life.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={finish} disabled={finishing || !splitValid} className="w-full h-12" size="lg">
        {finishing ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : null}
        Go to my dashboard
        {!finishing && <ArrowRight size={16} className="ml-1.5" />}
      </Button>
      {!uploaded && (
        <p className="text-center text-xs text-muted-foreground -mt-3">
          No statement yet? You can upload one anytime from the Upload tab.
        </p>
      )}
    </div>
  );
}
