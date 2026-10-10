import type { Category, Settings } from "@/types";

export const DRIVE_ROOT_FOLDER = "Monera";
/** Holds every uploaded statement, whatever the bank. The Drive name predates other banks. */
export const STATEMENTS_FOLDER = "revolut-exports";
export const APP_DATA_FOLDER = "app-data";

export const DRIVE_FILES = {
  manualTransactions: "manual-transactions.json",
  categoryOverrides: "category-overrides.json",
  settings: "settings.json",
  categoryRules: "category-rules.json",
  excludedTransactions: "excluded-transactions.json",
  parseCache: "parse-cache.json",
} as const;

// v2: currency is stored as an ISO code ("EUR"), not a symbol ("€").
export const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  currency: "EUR",
  paydayOfMonth: 1,
  defaultIncome: 0,
  defaultBudgetRule: { needs: 30, wants: 60, savings: 10 },
  monthlyBudgets: {},
  salaryKeywords: [],
  selfTransferKeywords: [],
  // Generic Revolut savings-vault phrasing — safe defaults the user can edit.
  savingsVaultKeywords: ["eur savings", "savings for"],
  recurringPayments: [],
  onboarded: false,
  excludedSubscriptions: [],
  tourPages: {},
  settingsVersion: SETTINGS_VERSION,
};

/** The categories a person can file spending under. */
export const BUDGET_CATEGORIES: Exclude<Category, "Uncategorized">[] = ["Needs", "Wants", "Savings"];

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export const WEEKDAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

/** Statements bigger than this are almost certainly the wrong file. */
export const MAX_STATEMENT_BYTES = 25 * 1024 * 1024;
