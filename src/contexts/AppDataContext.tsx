"use client";

import { createContext, useCallback, useContext, useMemo, useEffect, useState, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { Transaction, Settings, Category, CategoryRule } from "@/types";
import { DriveStructure } from "@/lib/google/folders";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions, type NewTransaction } from "@/hooks/useTransactions";
import { useSettings, type SettingsChange } from "@/hooks/useSettings";
import { useRules } from "@/hooks/useRules";
import { useToday } from "@/hooks/useToday";
import { billsBetween, billsStartDate } from "@/lib/recurring";
import { SetupScreen } from "@/components/layout/SetupScreen";
import { signOutAndClear } from "@/lib/session";
import { getCurrentPeriodKey, getPeriodKey, getPeriodRange } from "@/lib/periods";
import { currencyCode, dominantCurrency, setDisplayCurrency } from "@/lib/format";

interface AppDataContextValue {
  /** The pay period on screen, as "YYYY-MM" (the month it starts in). */
  periodKey: string;
  setPeriodKey: (key: string) => void;
  accessToken: string | undefined;
  /** ISO code of the currency most statement rows are in (falls back to settings). */
  currency: string;
  structure: DriveStructure | null;
  /** Only those in `currency`: amounts in different currencies can't be added up. */
  transactions: Transaction[];
  /** Transactions left out for being in another currency, and which currencies. */
  otherCurrency: { count: number; codes: string[] } | null;
  /**
   * The regular bills from Settings falling between `from` and `to` ("YYYY-MM-DD"),
   * with the user's category moves and leave-outs applied. Never before
   * `billsStart`. Bills aren't in `transactions`: every total that counts them
   * adds these, so all screens agree.
   */
  bills: (from: string, to: string) => Transaction[];
  /** Bills count from here: the start of the pay period of the first transaction. */
  billsStart: string;
  settings: Settings;
  /** Settings have loaded from Drive (or failed and fell back to defaults). */
  settingsLoaded: boolean;
  rules: CategoryRule[];
  rulesLoaded: boolean;
  isLoading: boolean;
  // True only once Drive structure, settings, and transactions have all loaded —
  // a reliable signal for first-run/onboarding decisions (isLoading can read false
  // before a load has even started).
  ready: boolean;
  txError: string | null;
  addManualTransaction: (tx: NewTransaction) => Promise<void>;
  deleteManualTransaction: (txId: string) => Promise<void>;
  updateManualTransaction: (id: string, updates: NewTransaction) => Promise<void>;
  updateCategory: (txId: string, category: Category) => Promise<void>;
  bulkUpdateCategory: (updates: { txId: string; category: Category }[]) => Promise<void>;
  bulkExclude: (ids: string[], shouldExclude: boolean) => Promise<void>;
  bulkResetToDefault: (ids: string[]) => Promise<void>;
  /** Takes a change to the latest settings, e.g. `(s) => ({ ...s, onboarded: true })`. */
  updateSettings: (change: SettingsChange) => Promise<void>;
  updateRules: (r: CategoryRule[]) => Promise<void>;
  refetch: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [periodKey, setPeriodKey] = useState(() => getCurrentPeriodKey());
  const { data: session } = useSession();
  const accessToken = session?.error ? undefined : session?.accessToken;
  const drive = useDrive(accessToken, session?.user?.email ?? undefined);
  const { structure } = drive;
  const { settings, updateSettings, settingsLoaded, settingsFailed, refetchSettings } = useSettings(accessToken, structure);
  const { rules, updateRules, rulesLoaded, rulesFailed, refetchRules } = useRules(accessToken, structure);
  const tx = useTransactions(accessToken, structure, rules, settings);

  // Show amounts in the currency the user's statements are actually in (a GBP
  // account shows £), falling back to the settings default. Set during render —
  // before any child renders — so every formatCurrency() call agrees.
  const currency = useMemo(() => dominantCurrency(tx.transactions) ?? settings.currency, [tx.transactions, settings.currency]);
  setDisplayCurrency(currency);

  // Every total adds amounts together, so only one currency can count. The rest
  // are left out everywhere (with a note), not silently added as if they were it.
  const { transactions, otherCurrency } = useMemo(() => {
    const kept: Transaction[] = [];
    const codes = new Set<string>();
    for (const t of tx.transactions) {
      const code = currencyCode(t.currency);
      if (code === currency) kept.push(t);
      else codes.add(code);
    }
    const count = tx.transactions.length - kept.length;
    return { transactions: count ? kept : tx.transactions, otherCurrency: count ? { count, codes: [...codes].sort() } : null };
  }, [tx.transactions, currency]);

  // Which pay period to show, kept right as data arrives (adjusted during render,
  // React's pattern for state that follows other values):
  //  - When the payday changes (settings load, onboarding, Settings), keep showing
  //    "now" under the new payday.
  //  - When statements load or a new one is added and none covers today's pay
  //    period yet (most people start with last month's export), show the latest
  //    period that has one instead of an empty dashboard.
  // Both only apply while on "now"; a period the user picked is left alone.
  const { paydayOfMonth } = settings;
  const latestStatementDate = useMemo(
    () => transactions.reduce<string | null>((latest, t) => (t.source === "statement" && (!latest || t.date > latest) ? t.date : latest), null),
    [transactions]
  );
  const today = useToday();
  const billsStart = useMemo(() => billsStartDate(transactions, paydayOfMonth, today), [transactions, paydayOfMonth, today]);
  const { recurringPayments } = settings;
  const { applyUserChanges } = tx;
  const bills = useCallback(
    (from: string, to: string) => applyUserChanges(billsBetween(recurringPayments, from, to, billsStart, paydayOfMonth, currency)),
    [applyUserChanges, recurringPayments, billsStart, paydayOfMonth, currency]
  );

  const [anchor, setAnchor] = useState({ payday: paydayOfMonth, latestStatement: null as string | null });
  const latestChanged = settingsLoaded && anchor.latestStatement !== latestStatementDate;
  if (anchor.payday !== paydayOfMonth || latestChanged) {
    let key = periodKey;
    if (anchor.payday !== paydayOfMonth && key === getCurrentPeriodKey(anchor.payday)) {
      key = getCurrentPeriodKey(paydayOfMonth);
    }
    const current = getCurrentPeriodKey(paydayOfMonth);
    if (latestChanged && latestStatementDate && key === current && latestStatementDate < getPeriodRange(current, paydayOfMonth).from) {
      key = getPeriodKey(latestStatementDate, paydayOfMonth);
    }
    setAnchor({ payday: paydayOfMonth, latestStatement: latestChanged ? latestStatementDate : anchor.latestStatement });
    if (key !== periodKey) setPeriodKey(key);
  }

  // If either hook detected an expired token, sign the user out immediately.
  useEffect(() => {
    if (drive.needsReauth || tx.needsReauth) signOutAndClear();
  }, [drive.needsReauth, tx.needsReauth]);

  const value = useMemo<AppDataContextValue>(
    () => ({
      periodKey,
      setPeriodKey,
      accessToken,
      currency,
      structure,
      transactions,
      otherCurrency,
      bills,
      billsStart,
      settings,
      settingsLoaded,
      rules,
      rulesLoaded,
      isLoading: drive.isLoading || tx.isLoading,
      ready: !!structure && settingsLoaded && tx.hasLoaded,
      txError: tx.error,
      addManualTransaction: tx.addManualTransaction,
      deleteManualTransaction: tx.deleteManualTransaction,
      updateManualTransaction: tx.updateManualTransaction,
      updateCategory: tx.updateCategory,
      bulkUpdateCategory: tx.bulkUpdateCategory,
      bulkExclude: tx.bulkExclude,
      bulkResetToDefault: tx.bulkResetToDefault,
      updateSettings,
      updateRules,
      refetch: tx.refetch,
    }),
    [
      periodKey, accessToken, currency, structure, transactions, otherCurrency, bills, billsStart, settings, settingsLoaded, rules, rulesLoaded,
      drive.isLoading, tx.isLoading, tx.hasLoaded, tx.error, tx.addManualTransaction, tx.deleteManualTransaction,
      tx.updateManualTransaction, tx.updateCategory, tx.bulkUpdateCategory, tx.bulkExclude, tx.bulkResetToDefault,
      tx.refetch, updateSettings, updateRules,
    ]
  );

  // Only show SetupScreen when we have a token (Drive initialization is actually
  // in progress). Without this guard, the "loading" flash during the
  // session-loading race after OAuth redirect would show SetupScreen prematurely
  // and then complete without Drive ever having fired.
  if (!structure && !!accessToken) {
    return <SetupScreen error={drive.error} onRetry={drive.refetch} />;
  }

  // Running on default settings or no rules after a failed read would show the
  // wrong numbers, and the next save would overwrite what's in Drive.
  if (settingsFailed || rulesFailed) {
    return (
      <SetupScreen
        error="load failed"
        errorTitle="Couldn't load your settings"
        errorMessage="We couldn't read your settings from Google Drive. This is usually temporary, so please try again."
        onRetry={() => {
          if (settingsFailed) refetchSettings();
          if (rulesFailed) refetchRules();
        }}
      />
    );
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
