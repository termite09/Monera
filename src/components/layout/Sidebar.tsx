"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { signOutAndClear } from "@/lib/session";
import { NAV_ITEMS } from "./navItems";
import { useAppData } from "@/contexts/AppDataContext";

export function Sidebar() {
  const pathname = usePathname();
  const { ready, settings } = useAppData();

  // First-run setup is one focused flow; don't offer ways out of it half-way.
  if (ready && !settings.onboarded) return null;

  return (
    <aside className="hidden lg:flex flex-col w-56 h-screen fixed left-0 top-0 bg-card border-r border-border z-30">
      <div className="px-5 py-6">
        <p className="text-2xl text-foreground font-serif">
          Monera
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Your money, your Drive</p>
      </div>

      <Separator />

      <nav aria-label="Main" className="flex-1 p-3 flex flex-col gap-0.5 mt-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/8 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-3">
        <button
          type="button"
          onClick={signOutAndClear}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut size={16} aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}
