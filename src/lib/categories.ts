import { Category } from "@/types";

/**
 * Category colour as a CSS value. Categories share one navy family told apart by
 * lightness; green/amber/red are reserved for budget status. Resolves through
 * theme tokens so it follows dark mode (works for SVG strokes and inline styles).
 */
const CATEGORY_COLORS: Record<Category, string> = {
  Needs: "var(--cat-needs)",
  Wants: "var(--cat-wants)",
  Savings: "var(--cat-savings)",
  Uncategorized: "var(--muted-foreground)",
};

export function getCategoryColor(category: Category): string {
  return CATEGORY_COLORS[category];
}

const CATEGORY_SWATCHES: Record<Category, string> = {
  Needs: "bg-cat-needs",
  Wants: "bg-cat-wants",
  Savings: "bg-cat-savings",
  Uncategorized: "bg-muted-foreground/40",
};

/** Background class for a category swatch (always shown next to its label). */
export function getCategorySwatchClass(category: Category): string {
  return CATEGORY_SWATCHES[category];
}

/**
 * Text class for a category label. Labels stay in readable ink — the swatch
 * carries the category colour — so Wants never reads as a warning.
 */
export function getCategoryTextClass(category: Category): string {
  return category === "Uncategorized" ? "text-muted-foreground" : "text-foreground";
}
