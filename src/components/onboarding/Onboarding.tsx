"use client";

import { useRef, useState } from "react";
import { Check, Upload, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppData } from "@/contexts/AppDataContext";
import { readStatement, saveStatement, statementErrorMessage } from "@/lib/statements";
import { cn, formatCurrency, getDisplayCurrency, ordinal, plural } from "@/lib/utils";
import { RevolutExportHelp } from "@/components/onboarding/RevolutExportHelp";
import { markOnboardedThisSession } from "@/components/onboarding/AppTour";

const STEPS = ["payday", "pay", "split", "statement"] as const;
type Step = (typeof STEPS)[number];

const SPLIT_ROWS = [
  { key: "needs", label: "Needs", hint: "Rent, groceries, bills, transport", swatch: "bg-cat-needs" },
  { key: "wants", label: "Wants", hint: "Eating out, shopping, subscriptions", swatch: "bg-cat-wants" },
  { key: "savings", label: "Savings", hint: "Money you put aside or invest", swatch: "bg-cat-savings" },
] as const;

export function Onboarding() {
  const { accessToken, structure, settings, transactions, updateSettings, refetch } = useAppData();

  const [step, setStep] = useState<Step>("payday");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadMsg, setUploadMsg] = useState("");
  // A fresh account's payday is the default 1; leave it empty so it's a real choice.
  const [payday, setPayday] = useState(settings.onboarded || settings.paydayOfMonth > 1 ? String(settings.paydayOfMonth) : "");
  const [salary, setSalary] = useState(settings.defaultIncome ? String(settings.defaultIncome) : "");
  // New accounts start from the 50 / 30 / 20 split the copy recommends.
  const [split, setSplit] = useState(settings.onboarded ? settings.defaultBudgetRule : { needs: 50, wants: 30, savings: 20 });
  const [finishing, setFinishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const index = STEPS.indexOf(step);
  const uploaded = uploadState === "done" || transactions.length > 0;
  const splitTotal = split.needs + split.wants + split.savings;
  const splitValid = splitTotal === 100;
  const paydayNum = parseInt(payday, 10);
  const paydayValid = paydayNum >= 1 && paydayNum <= 31;
  const pay = Math.max(0, parseFloat(salary) || 0);
  const symbol = getDisplayCurrency().trim();

  const handleFile = async (file?: File | null) => {
    if (!file || !accessToken || !structure) return;
    setUploadState("uploading");
    setUploadMsg("");
    try {
      const statement = await readStatement(file);
      await saveStatement(accessToken, structure, statement);
      setUploadState("done");
      setUploadMsg(`Added ${plural(statement.count, "transaction")}.`);
      refetch();
    } catch (err) {
      setUploadState("error");
      setUploadMsg(statementErrorMessage(err));
    }
  };

  const finish = async () => {
    if (!splitValid) return;
    setFinishing(true);
    const day = Math.min(31, Math.max(1, paydayNum || 1));
    try {
      // Persist payday, standing pay, budget split, and mark onboarding complete
      // in one write. Tours wait until the next visit so the first look at the
      // dashboard isn't covered by a sheet.
      markOnboardedThisSession();
      await updateSettings({
        ...settings,
        paydayOfMonth: day,
        defaultIncome: pay,
        defaultBudgetRule: split,
        onboarded: true,
      });
    } finally {
      setFinishing(false);
    }
  };

  const canContinue =
    step === "payday" ? paydayValid :
    step === "split" ? splitValid :
    true;

  const next = () => {
    if (!canContinue) return;
    if (index < STEPS.length - 1) setStep(STEPS[index + 1]);
  };

  return (
    <div className="p-4 max-w-md mx-auto flex flex-col pt-6 min-h-[calc(100dvh-8rem)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Setting up Monera</span>
        <span className="text-sm text-muted-foreground">Step {index + 1} of {STEPS.length}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={index + 1}
        className="mt-3 grid grid-cols-4 gap-1"
      >
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 rounded-full transition-colors", i <= index ? "bg-primary" : "bg-border")} />
        ))}
      </div>

      <form
        className="flex flex-col flex-1 mt-8"
        onSubmit={(e) => { e.preventDefault(); if (step === "statement") finish(); else next(); }}
      >
        {step === "payday" && (
          <section className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">When do you get paid?</h1>
            <p className="text-base leading-relaxed text-foreground/80">
              Monera follows your pay, not the calendar: each pay period runs from one payday to the next. Your data stays in a private Monera folder in your Google Drive.
            </p>
            <Label htmlFor="ob-payday" className="mt-4">Day of the month</Label>
            <Input
              id="ob-payday"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              placeholder="e.g. 24"
              value={payday}
              onChange={(e) => setPayday(e.target.value)}
              className="h-12 w-32 text-base font-mono tabular-nums"
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {payday === ""
                ? "Your pay periods will run from one payday to the next."
                : !paydayValid
                  ? "Enter a day between 1 and 31."
                  : paydayNum > 28
                    ? `Your pay periods will start on the ${ordinal(paydayNum)}, or the last day of shorter months.`
                    : `Your pay periods will start on the ${ordinal(paydayNum)}.`}
            </p>
          </section>
        )}

        {step === "pay" && (
          <section className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">How much do you get paid?</h1>
            <p className="text-base leading-relaxed text-foreground/80">
              Roughly what lands in your account each payday, after tax. Monera uses it until your statement shows the real payment, then uses that instead, so it&apos;s never counted twice. Not sure? Leave it blank.
            </p>
            <Label htmlFor="ob-salary" className="mt-4">Pay per period</Label>
            <div className="flex items-center gap-2">
              <span className="text-base text-muted-foreground font-mono">{symbol}</span>
              <Input
                id="ob-salary"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="e.g. 2400"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="h-12 w-40 text-base font-mono tabular-nums"
              />
            </div>
          </section>
        )}

        {step === "split" && (
          <section className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">How would you like to split your pay?</h1>
            <p className="text-base leading-relaxed text-foreground/80">
              Monera checks your spending against this each pay period. Most people start with 50 / 30 / 20 and adjust later.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-card divide-y divide-border">
              {SPLIT_ROWS.map(({ key, label, hint, swatch }) => (
                <div key={key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`ob-${key}`} className="flex items-center gap-2 text-base font-semibold">
                      <span className={cn("size-2.5 rounded-sm", swatch)} aria-hidden />
                      {label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">{hint}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <Input
                        id={`ob-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={String(split[key])}
                        onChange={(e) => setSplit((s) => ({ ...s, [key]: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) }))}
                        className="h-11 w-16 text-right font-mono tabular-nums"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    {pay > 0 && (
                      <p className="text-xs text-muted-foreground font-mono tabular-nums mt-1">
                        {formatCurrency((pay * split[key]) / 100)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className={cn("text-sm flex items-center gap-1.5", splitValid ? "text-muted-foreground" : "text-destructive")} aria-live="polite">
              {splitValid ? (
                <><Check size={14} className="text-foreground" aria-hidden />Adds up to 100%{pay > 0 && <> of your <span className="font-mono tabular-nums">{formatCurrency(pay)}</span> pay</>}</>
              ) : (
                <><AlertCircle size={14} aria-hidden />Adds up to {splitTotal}%. It needs to be 100%.</>
              )}
            </p>
          </section>
        )}

        {step === "statement" && (
          <section className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Add your first statement</h1>
            <p className="text-base leading-relaxed text-foreground/80">
              Export a CSV or Excel statement from Revolut and add it here. It takes about two minutes, and once per pay period is enough.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />
            {uploaded ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-foreground" role="status">
                <Check size={16} className="text-foreground" aria-hidden /> {uploadMsg || "Statement added."}
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  className="mt-4 h-12 self-start px-6"
                  disabled={uploadState === "uploading"}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadState === "uploading" ? (
                    <><Loader2 size={16} className="mr-1.5 animate-spin" aria-hidden /> Adding…</>
                  ) : (
                    <><Upload size={16} className="mr-1.5" aria-hidden /> Choose a file</>
                  )}
                </Button>
                {uploadState === "error" && (
                  <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden /> {uploadMsg}
                  </p>
                )}
                <RevolutExportHelp />
              </>
            )}
          </section>
        )}

        <div className="mt-auto pt-8 flex flex-col gap-3">
          {step === "statement" && !uploaded && (
            <p className="text-center text-sm text-muted-foreground">
              No statement yet? You can add one later from Statements.
            </p>
          )}
          <div className={cn("grid gap-2", index > 0 ? "grid-cols-[1fr_2fr]" : "grid-cols-1")}>
            {index > 0 && (
              <Button type="button" variant="outline" className="h-12" onClick={() => setStep(STEPS[index - 1])}>
                Back
              </Button>
            )}
            {step === "statement" ? (
              <Button type="submit" variant={uploaded ? "default" : "outline"} className="h-12" disabled={finishing || !splitValid}>
                {finishing && <Loader2 size={16} className="mr-1.5 animate-spin" aria-hidden />}
                {uploaded ? "Go to my dashboard" : "Skip for now"}
                {!finishing && <ArrowRight size={16} className="ml-1.5" aria-hidden />}
              </Button>
            ) : (
              <Button type="submit" className="h-12" disabled={!canContinue}>
                Continue
                <ArrowRight size={16} className="ml-1.5" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
