"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { InfoIcon } from "@/components/ui/InfoIcon";

interface BudgetDonutProps {
  label: string;
  spent: number;
  allocated: number;
  color: string;
  labelClass: string;
  info?: string;
  onClick?: () => void;
}

function compactAmount(n: number): string {
  if (n >= 1000) return `€${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n >= 100) return `€${n.toFixed(1)}`;
  return `€${n.toFixed(2)}`;
}

function amountFontSize(s: string): string {
  if (s.length <= 5) return "text-base";
  if (s.length <= 7) return "text-sm";
  return "text-xs";
}

// Internal SVG coordinate space; the <svg> scales to its container via viewBox.
const VB = 116;
const STROKE = 12;

export function BudgetDonut({ label, spent, allocated, color, labelClass, info, onClick }: BudgetDonutProps) {
  const router = useRouter();
  const over = spent > allocated;
  const remaining = Math.max(0, allocated - spent);
  const pct = allocated > 0 ? Math.min(spent / allocated, 1) : 0;

  const r = (VB - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const dash = pct * c;
  const arcColor = over ? "#ef4444" : color;

  const infoText = allocated === 0 && info
    ? `${info} Go to Settings → Budget to configure your budget split.`
    : info;

  return (
    <div className="flex flex-col items-center gap-2.5 min-w-0">
      <div className="flex items-center gap-1">
        <p className={cn("text-xs font-semibold uppercase tracking-wider", labelClass)}>{label}</p>
        {info && (
          <InfoIcon
            content={infoText!}
            side="top"
            onClick={allocated === 0 ? () => router.push("/settings") : undefined}
          />
        )}
      </div>

      <div
        className={cn("relative w-full aspect-square", onClick && "cursor-pointer")}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      >
        <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full h-full block">
          <circle
            cx={VB / 2}
            cy={VB / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-slate-200 dark:text-slate-700"
          />
          {allocated > 0 && (
            <circle
              cx={VB / 2}
              cy={VB / 2}
              r={r}
              fill="none"
              stroke={arcColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          {(() => {
            const display = allocated > 0 ? compactAmount(over ? spent - allocated : remaining) : "—";
            return (
              <span className={cn("font-bold tabular-nums leading-none text-center font-mono", amountFontSize(display), over ? "text-destructive" : allocated > 0 ? "text-foreground" : "text-muted-foreground")}>
                {display}
              </span>
            );
          })()}
          {allocated > 0 && (
            <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground leading-none mt-1.5">
              {over ? "over" : "left"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
