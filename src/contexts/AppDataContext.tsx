"use client";

import { createContext, useContext, ReactNode } from "react";
import { Transaction, Settings, Category, CategoryRule } from "@/types";
import { DriveStructure } from "@/lib/google/folders";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { useSettings } from "@/hooks/useSettings";
import { useRules } from "@/hooks/useRules";

interface AppDataContextValue {
  structure: DriveStructure | null;
  transactions: Transaction[];
  settings: Settings;
  isLoading: boolean;
  rules: CategoryRule[];
  addManualTransaction: (tx: Omit<Transaction, "id" | "source" | "categorySource">) => Promise<void>;
  updateCategory: (txId: string, category: Category) => Promise<void>;
  toggleExclude: (txId: string) => Promise<void>;
  updateSettings: (s: Settings) => Promise<void>;
  updateRules: (r: CategoryRule[]) => Promise<void>;
  refetch: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const { structure, isLoading: isDriveLoading } = useDrive(accessToken);
  const { rules, updateRules } = useRules(accessToken, structure);
  const {
    transactions,
    isLoading: isTxLoading,
    addManualTransaction,
    updateCategory,
    toggleExclude,
    refetch,
  } = useTransactions(accessToken, structure, rules);
  const { settings, updateSettings } = useSettings(accessToken, structure);

  const isLoading = isDriveLoading || isTxLoading;

  return (
    <AppDataContext.Provider
      value={{ structure, transactions, settings, rules, isLoading, addManualTransaction, updateCategory, toggleExclude, updateSettings, updateRules, refetch }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}
