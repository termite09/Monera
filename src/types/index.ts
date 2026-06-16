export type Category = "Needs" | "Wants" | "Savings" | "Uncategorized";
export type TransactionSource = "revolut" | "manual";
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
  month: string;
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

export interface Settings {
  currency: string;
  defaultBudgetRule: { needs: number; wants: number; savings: number };
  monthlyBudgets: Record<string, MonthlyBudget>;
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
