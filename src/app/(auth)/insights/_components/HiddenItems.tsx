"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Hidden (2)": opens the list of what's been hidden, each with its own Show,
 * so bringing one back doesn't bring back everything.
 */
export function HiddenItems({ names, note, onShow, onShowAll, onAfterShow, className }: {
  names: string[];
  /** What hiding does and doesn't change, for this list. */
  note: string;
  onShow: (name: string) => void;
  onShowAll: () => void;
  /** Showing removes the focused button (or this whole list), so focus moves here. */
  onAfterShow: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (names.length === 0) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="tap-area inline-flex items-center gap-1 text-xs text-primary hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Hidden ({names.length})
        <ChevronDown size={12} aria-hidden className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-secondary/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">{note}</p>
          <ul className="mt-1 divide-y divide-border">
            {names.map((name) => (
              <li key={name} className="flex items-center gap-2 py-1">
                <span className="flex-1 min-w-0 text-sm text-foreground wrap-break-word">{name}</span>
                <button
                  type="button"
                  onClick={() => { onShow(name); onAfterShow(); }}
                  aria-label={`Show ${name} again`}
                  className="shrink-0 min-h-11 px-3 text-xs text-primary rounded-md hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Show
                </button>
              </li>
            ))}
          </ul>
          {names.length > 1 && (
            <button
              type="button"
              onClick={() => { onShowAll(); setOpen(false); onAfterShow(); }}
              className="min-h-11 text-xs text-primary hover:underline rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
