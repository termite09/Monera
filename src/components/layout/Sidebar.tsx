"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Upload, Settings, BarChart2, PieChart, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/reports", label: "Reports", icon: PieChart },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/year-overview", label: "Year Overview", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 h-screen fixed left-0 top-0 bg-card border-r border-border z-30">
      <div className="px-5 py-6">
        <h1 className="text-2xl text-foreground" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Monera
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">Personal Finance</p>
      </div>

      <Separator />

      <nav className="flex-1 p-3 flex flex-col gap-0.5 mt-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/8 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-3">
        <button
          onClick={() => signOut({ redirectTo: "/login" })}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
