export const APP_NAME = "Monera";
export const DRIVE_ROOT_FOLDER = "Monera";
export const REVOLUT_EXPORTS_FOLDER = "revolut-exports";
export const APP_DATA_FOLDER = "app-data";

export const DRIVE_FILES = {
  manualTransactions: "manual-transactions.json",
  categoryOverrides: "category-overrides.json",
  settings: "settings.json",
  categoryRules: "category-rules.json",
} as const;

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Needs: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
  Wants: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  Savings: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  Uncategorized: { bg: "bg-gray-50 dark:bg-gray-800/30", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
};

export const SOURCE_COLORS = {
  revolut: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-[#0075EB]", border: "border-blue-200 dark:border-blue-800" },
  manual: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
};

export const DEFAULT_SETTINGS = {
  currency: "€",
  paydayOfMonth: 1,
  defaultBudgetRule: { needs: 30, wants: 60, savings: 10 },
  monthlyBudgets: {},
};

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
