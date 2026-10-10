import { Category } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { Search, X, Plus } from "lucide-react";

/** Which list is showing. Savings sits apart from Expenses: it isn't spending. */
export type ListType = "expense" | "savings" | "income" | "all";
export type RangeMode = "period" | "custom";
export type CategoryFilter = Category | "All";

const LIST_TYPES: { value: ListType; label: string }[] = [
  { value: "expense", label: "Expenses" },
  { value: "savings", label: "Savings" },
  { value: "income", label: "Income" },
  { value: "all", label: "All" },
];

const RANGE_MODES: { value: RangeMode; label: string }[] = [
  { value: "period", label: "This period" },
  { value: "custom", label: "Custom" },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  listType: ListType;
  onListTypeChange: (v: ListType) => void;
  category: CategoryFilter;
  onCategoryChange: (v: CategoryFilter) => void;
  rangeMode: RangeMode;
  onRangeModeChange: (v: RangeMode) => void;
  customFrom: string;
  onCustomFromChange: (v: string) => void;
  customTo: string;
  onCustomToChange: (v: string) => void;
  onAdd: () => void;
}

export function TransactionFilters({
  search, onSearchChange,
  listType, onListTypeChange,
  category, onCategoryChange,
  rangeMode, onRangeModeChange,
  customFrom, onCustomFromChange,
  customTo, onCustomToChange,
  onAdd,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="tx-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search transactions…"
            aria-label="Search transactions"
            className="w-full h-11 pl-9 pr-8 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <Button onClick={onAdd} size="sm" className="h-11 shrink-0 px-4">
          <Plus size={14} className="mr-1.5" aria-hidden />
          Add
        </Button>
      </div>

      {/* Row 2: List type */}
      <Segmented
        items={LIST_TYPES}
        value={listType}
        onChange={onListTypeChange}
        label="Show"
        kind="radio"
        className="grid grid-cols-4 gap-0.5 p-0.5 rounded-lg bg-secondary"
        itemClassName="min-h-11 sm:min-h-8 rounded-md text-xs"
      />

      {/* Row 3: Category + Period/Custom */}
      <div className="flex items-center gap-2">
        <div className={cn("flex-1 min-w-0", (listType === "income" || listType === "savings") && "invisible pointer-events-none")}>
          <NativeSelect
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as CategoryFilter)}
            aria-label="Filter by category"
            className="h-11 sm:h-8 text-xs w-full"
          >
            <option value="All">All categories</option>
            <option value="Needs">Needs</option>
            <option value="Wants">Wants</option>
            <option value="Uncategorized">No category</option>
          </NativeSelect>
        </div>
        {/* A search looks across the whole range already chosen, so the range stays put while searching. */}
        {!search.trim() && (
          <Segmented
            items={RANGE_MODES}
            value={rangeMode}
            onChange={onRangeModeChange}
            label="Date range"
            kind="radio"
            className="flex gap-0.5 p-0.5 rounded-lg bg-secondary shrink-0"
            itemClassName="px-2.5 min-h-10 sm:min-h-7 rounded-md text-xs whitespace-nowrap"
          />
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
