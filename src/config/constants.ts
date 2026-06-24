export const DRIVE_ROOT_FOLDER = "Monera";
export const REVOLUT_EXPORTS_FOLDER = "revolut-exports";
export const APP_DATA_FOLDER = "app-data";

export const DRIVE_FILES = {
  manualTransactions: "manual-transactions.json",
  categoryOverrides: "category-overrides.json",
  settings: "settings.json",
  categoryRules: "category-rules.json",
  excludedTransactions: "excluded-transactions.json",
  parseCache: "parse-cache.json",
} as const;

export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS = {
  currency: "€",
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
  excludedSubscriptions: [] as string[],
  tourPages: {} as Record<string, boolean>,
  settingsVersion: SETTINGS_VERSION,
};

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export const WEEKDAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
