import { Category, TransactionSource } from "@/types";
import { CATEGORY_COLORS, SOURCE_COLORS } from "@/config/constants";

interface CategoryBadgeProps {
  category: Category;
}

interface SourceBadgeProps {
  source: TransactionSource;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const colors = CATEGORY_COLORS[category];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
        ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {category}
    </span>
  );
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const colors = SOURCE_COLORS[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
        ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {source === "revolut" ? "Revolut" : "Manual"}
    </span>
  );
}
