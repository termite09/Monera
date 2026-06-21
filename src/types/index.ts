export type Category = "Needs" | "Wants" | "Savings" | "Uncategorized";
export type TransactionSource = "revolut" | "manual" | "recurring";
export type CategorySource = "auto" | "override" | "manual";
export type TransactionType = "expense" | "income";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  currency: string;
  category: Category;
  source: TransactionSource;
  categorySource: CategorySource;
  notes?: string;
  excluded: boolean;
}

export interface MonthlyBudget {
  month: string;
  income: number;
  budgetRule: {
    needs: number;
    wants: number;
    savings: number;
  };
}

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  category: Category;
  /** YYYY-MM period key from which this payment applies (inclusive). Undefined = all past periods too. */
  startMonth?: string;
  /** YYYY-MM period key until which this payment applies (inclusive). Undefined = no end date. */
  endMonth?: string;
}

export interface Settings {
  currency: string;
  paydayOfMonth: number;
  /** Standing monthly salary, used as income for every period unless that period has its own configured income. 0 = fall back to statement-detected income. */
  defaultIncome?: number;
  defaultBudgetRule: { needs: number; wants: number; savings: number };
  monthlyBudgets: Record<string, MonthlyBudget>;
  /** Descriptions identifying your salary — excluded from "received from others". */
  salaryKeywords: string[];
  /** Descriptions identifying transfers between your own accounts — dropped entirely. */
  selfTransferKeywords: string[];
  /** Descriptions identifying Revolut savings-vault deposits — positive mirror dropped. */
  savingsVaultKeywords: string[];
  recurringPayments: RecurringPayment[];
  /** True once the user has finished (or skipped) the first-run setup flow. */
  onboarded?: boolean;
  /** Keys are page identifiers; true means the user has dismissed the tour for that page. */
  tourPages?: Record<string, boolean>;
  /** Merchant names hidden from the Insights → Merchants view (does not affect calculations). */
  hiddenMerchants?: string[];
  /** Schema version — incremented when new default fields are added. */
  settingsVersion?: number;
}

export interface CategoryRule {
  keyword: string;
  category: Category;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size?: string;
}

export interface ParsedCSV {
  transactions: Transaction[];
  errors: string[];
}

export interface MonthSummary {
  income: number;
  totalExpenses: number;
  needs: number;
  wants: number;
  savings: number;
  remaining: number;
}
