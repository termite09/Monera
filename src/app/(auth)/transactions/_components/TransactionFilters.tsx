import { Category, TransactionType } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, Plus } from "lucide-react";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filterType: TransactionType | "all";
  onFilterTypeChange: (v: TransactionType | "all") => void;
  filterCat: Category | "All";
  onFilterCatChange: (v: Category | "All") => void;
  rangeMode: "period" | "custom";
  onPeriodMode: () => void;
  onCustomMode: () => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
  searching: boolean;
  onAdd: () => void;
}

export function TransactionFilters({
  search, onSearchChange,
  filterType, onFilterTypeChange,
  filterCat, onFilterCatChange,
  rangeMode, onPeriodMode, onCustomMode,
  customFrom, onCustomFromChange,
  customTo, onCustomToChange,
  searching, onAdd,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transactions..."
            className="w-full h-11 pl-9 pr-8 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Button onClick={onAdd} size="sm" className="h-11 shrink-0 px-4">
          <Plus size={14} className="mr-1.5" />
          Add
        </Button>
      </div>

      {/* Row 2: Type filter */}
      <div className="grid grid-cols-3 gap-0.5 p-0.5 rounded-lg bg-secondary">
        {(
          [
            { value: "expense" as const, label: "Expenses" },
            { value: "income" as const, label: "Income" },
            { value: "all" as const, label: "All" },
          ] as { value: TransactionType | "all"; label: string }[]
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onFilterTypeChange(value)}
            className={cn(
              "py-1.5 rounded-md text-xs font-medium transition-colors",
              filterType === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Row 3: Category + Period/Custom */}
      <div className="flex items-center gap-2">
        <div className={cn("flex-1 min-w-0", filterType === "income" && "invisible pointer-events-none")}>
          <Select value={filterCat} onValueChange={(v) => onFilterCatChange(v as Category | "All")}>
            <SelectTrigger className="h-8 text-xs w-full" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All categories</SelectItem>
              <SelectItem value="Needs">Needs</SelectItem>
              <SelectItem value="Wants">Wants</SelectItem>
              <SelectItem value="Savings">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!searching && (
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-secondary shrink-0">
            <button
              onClick={onPeriodMode}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                rangeMode === "period" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Period
            </button>
            <button
              onClick={onCustomMode}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                rangeMode === "custom" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Custom
            </button>
          </div>
        )}
      </div>

      {/* Custom date range inputs */}
      {rangeMode === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => onCustomFromChange(e.target.value)}
            aria-label="From date"
            className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground shrink-0">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => onCustomToChange(e.target.value)}
            aria-label="To date"
            className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
    </div>
  );
}
