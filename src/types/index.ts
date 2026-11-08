export type Category = "Needs" | "Wants" | "Savings" | "Uncategorized";
/** "statement" = imported from a bank export, "recurring" = generated from a bill in Settings. */
export type TransactionSource = "statement" | "manual" | "recurring";
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
  /** For a bill (source "recurring"): the id of the bill in Settings it came from. */
  billId?: string;
  /**
   * Revolut rows: start time to the second, amount and currency. Matches one
   * transaction across overlapping exports even when Revolut renames the shop
   * between them ("Delivery Hero" pending, "foody" settled).
   */
  matchKey?: string;
  /** Still pending when it was exported. */
  pending?: boolean;
  /** Money back for a purchase (a refund row in the statement). */
  refund?: boolean;
  /** Money moved into a savings vault, recognised by its mirror row (which is dropped). */
  savingsMove?: boolean;
  /** Ids this transaction had in other exports, so changes made under them still apply. */
  aliases?: string[];
}

/** Pay and split for one pay period, overriding the defaults. */
export interface PeriodBudget {
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
  /** ISO currency code, e.g. "EUR". Only the fallback when no statement says otherwise. */
  currency: string;
  paydayOfMonth: number;
  /** Standing monthly salary, used as income for every period unless that period has its own configured income. 0 = fall back to statement-detected income. */
  defaultIncome?: number;
  defaultBudgetRule: { needs: number; wants: number; savings: number };
  /** Per-period overrides keyed by pay-period key ("YYYY-MM"); the stored name predates pay periods. */
  monthlyBudgets: Record<string, PeriodBudget>;
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
  /** Detected subscription names the user has dismissed — does not affect calculations. */
  excludedSubscriptions?: string[];
  /**
   * Money in from other people (a friend paying back their share) reduces your
   * spending instead of counting as income. Pay is still recognised by the
   * salary keywords.
   */
  repaymentsReduceSpending?: boolean;
  /** True once the user has dismissed the post-import recurring-bills nudge. */
  recurringNudgeDismissed?: boolean;
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
  /** Match keys of declined, failed or reverted payments: they cancel a pending copy from an earlier export. */
  cancelled?: string[];
  /** What a Revolut export covers, per currency, with its balance at each end. */
  coverage?: StatementCoverage[];
}

/**
 * The days one statement covers for one currency of the main account, and
 * Revolut's balance just before its first settled row and after its last. Two
 * statements that don't meet leave a gap only if the balance changed in between.
 */
export interface StatementCoverage {
  currency: string;
  /** First and last day a payment settled ("YYYY-MM-DD"). */
  from: string;
  to: string;
  openingBalance: number;
  closingBalance: number;
}

export interface PeriodSummary {
  income: number;
  totalExpenses: number;
  needs: number;
  wants: number;
  savings: number;
  remaining: number;
}

/** Where a pay period sits relative to today. */
export type PeriodTiming = "current" | "past" | "future";
