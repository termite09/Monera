"use client";

import { createContext, useContext, useMemo, useEffect, useState, ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Transaction, Settings, Category, CategoryRule } from "@/types";
import { DriveStructure } from "@/lib/google/folders";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { useSettings } from "@/hooks/useSettings";
import { useRules } from "@/hooks/useRules";
import { SetupScreen } from "@/components/layout/SetupScreen";
import { getCurrentMonth } from "@/lib/utils";

interface AppDataContextValue {
  month: string;
  setMonth: (m: string) => void;
  structure: DriveStructure | null;
  transactions: Transaction[];
  settings: Settings;
  isLoading: boolean;
  // True only once Drive structure, settings, and transactions have all loaded —
  // a reliable signal for first-run/onboarding decisions (isLoading can read false
  // before a load has even started).
  ready: boolean;
  txError: string | null;
  rules: CategoryRule[];
  addManualTransaction: (tx: Omit<Transaction, "id" | "source" | "categorySource">) => Promise<void>;
  deleteManualTransaction: (txId: string) => Promise<void>;
  updateCategory: (txId: string, category: Category) => Promise<void>;
  bulkUpdateCategory: (updates: { txId: string; category: Category }[]) => Promise<void>;
  revertCategory: (txId: string) => Promise<void>;
  toggleExclude: (txId: string) => Promise<void>;
  updateSettings: (s: Settings) => Promise<void>;
  updateRules: (r: CategoryRule[]) => Promise<void>;
  refetch: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(getCurrentMonth());
  const { accessToken, session } = useAuth();
  const { structure, isLoading: isDriveLoading, error: driveError, needsReauth: driveNeedsReauth, refetch: refetchDrive } = useDrive(accessToken, session?.user?.email ?? undefined);
  const { settings, updateSettings, settingsLoaded } = useSettings(accessToken, structure);
  const { rules, updateRules } = useRules(accessToken, structure);
  const {
    transactions,
    isLoading: isTxLoading,
    hasLoaded: txLoaded,
    error: txError,
    needsReauth: txNeedsReauth,
    addManualTransaction,
    deleteManualTransaction,
    updateCategory,
    bulkUpdateCategory,
    revertCategory,
    toggleExclude,
    refetch,
  } = useTransactions(accessToken, structure, rules, settings);

  const isLoading = isDriveLoading || isTxLoading;
  const ready = !!structure && settingsLoaded && txLoaded;

  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  // Re-anchor the selected period once the user's real payday loads (it starts at
  // the default of 1 before settings arrive). This is an intentional sync from an
  // external source (Drive settings), not a render-driven cascade.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  // If either hook detected an expired token, sign the user out immediately.
  useEffect(() => {
    if (driveNeedsReauth || txNeedsReauth) {
      signOut({ redirectTo: "/login" });
    }
  }, [driveNeedsReauth, txNeedsReauth]);

  const value = useMemo(
    () => ({
      month,
      setMonth,
      structure,
      transactions,
      settings,
      rules,
      isLoading,
      ready,
      txError,
      addManualTransaction,
      deleteManualTransaction,
      updateCategory,
      bulkUpdateCategory,
      revertCategory,
      toggleExclude,
      updateSettings,
      updateRules,
      refetch,
    }),
    [month, setMonth, structure, transactions, settings, rules, isLoading, ready, txError, addManualTransaction, deleteManualTransaction, updateCategory, bulkUpdateCategory, revertCategory, toggleExclude, updateSettings, updateRules, refetch]
  );

  // Only show SetupScreen when we have a token (Drive initialization is actually
  // in progress). Without this guard, the "loading" flash during the
  // session-loading race after OAuth redirect would show SetupScreen prematurely
  // and then complete without Drive ever having fired.
  if (!structure && !!accessToken) {
    return <SetupScreen error={driveError} onRetry={refetchDrive} />;
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
