"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface Item<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  items: Item<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Insights sections". */
  label: string;
  /**
   * "tabs" switches panels (pair with <TabPanel>); "radio" picks one option that
   * changes the content in place (e.g. a chart's range).
   */
  kind?: "tabs" | "radio";
  /** Prefix for tab/panel ids — required for kind="tabs". */
  idPrefix?: string;
  className?: string;
  itemClassName?: string;
}

/**
 * The app's segmented control, with the keyboard behaviour people expect:
 * one Tab stop for the group, arrow keys (and Home/End) to move between options.
 */
export function Segmented<T extends string>({
  items, value, onChange, label, kind = "tabs", idPrefix = "seg", className, itemClassName,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (e: KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role={kind === "tabs" ? "tablist" : "radiogroup"} aria-label={label} className={className}>
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role={kind === "tabs" ? "tab" : "radio"}
            id={kind === "tabs" ? `${idPrefix}-tab-${item.value}` : undefined}
            aria-controls={kind === "tabs" ? `${idPrefix}-panel` : undefined}
            aria-selected={kind === "tabs" ? active : undefined}
            aria-checked={kind === "radio" ? active : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground border border-border"
                : "text-foreground/70 hover:text-foreground border border-transparent",
              itemClassName
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** The panel a <Segmented kind="tabs"> controls. */
export function TabPanel({ idPrefix, value, children, className }: { idPrefix: string; value: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${value}`} className={className}>
      {children}
    </div>
  );
}
