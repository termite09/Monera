"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { useAppData } from "@/contexts/AppDataContext";
import { cn } from "@/lib/utils";
import { MonthForm } from "@/components/settings/MonthForm";
import { DefaultsForm } from "@/components/settings/DefaultsForm";
import { RecurringForm } from "@/components/settings/RecurringForm";
import { RulesForm } from "@/components/settings/RulesForm";
import { IncomeForm } from "@/components/settings/IncomeForm";
import { AppTour } from "@/components/onboarding/AppTour";

const SETTINGS_SLIDES = [
  {
    title: "Setup — your defaults",
    body: "Start here. Enter your monthly salary, payday, and how you want to split your budget between Needs, Wants, and Savings. Every period uses these unless you override them.",
  },
  {
    title: "Monthly — period overrides",
    body: "Need to adjust just one month? Set a different income or budget split here without touching your defaults. Useful for months with a bonus or unusual expenses.",
  },
  {
    title: "Payments — recurring",
    body: "Add fixed payments you make from another account — rent, insurance, gym, savings transfers. Monera uses these to show your committed spending and flag missing payments.",
  },
  {
    title: "Sources — income detection",
    body: "Tell Monera your employer name so it can identify your salary in your statement. You can also set keywords to detect transfers between your own accounts and exclude them from spending.",
  },
  {
    title: "Mappings — auto-categorisation",
    body: "Mappings link keywords in transaction descriptions to categories automatically. The more you categorise, the smarter it gets over time.",
  },
];

type Tab = "setup" | "monthly" | "bills" | "sources" | "rules";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { month, setMonth, settings, rules, isLoading, txError, refetch, updateSettings, updateRules } = useAppData();
  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return (t === "setup" || t === "monthly" || t === "bills" || t === "sources" || t === "rules") ? t : "setup";
  });

  const handleSignOut = useCallback(() => {
    sessionStorage.clear();
    signOut({ redirectTo: "/login" });
  }, []);

  const replayGuide = useCallback(async () => {
    await updateSettings({ ...settings, tourPages: {} });
    router.push("/dashboard");
  }, [settings, updateSettings, router]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "setup", label: "Setup" },
    { id: "monthly", label: "Monthly" },
    { id: "bills", label: "Payments" },
    { id: "sources", label: "Sources" },
    { id: "rules", label: "Mappings" },
  ];

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-5">
        {/* Account row — mobile only, always at the top */}
        <div className="md:hidden flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {session?.user?.image ? (
            <>
                {/* eslint-disable-next-line @next/next/no-img-element -- referrerPolicy is required for Google avatars and is not supported by next/image */}
                <img
                  src={session.user.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-9 rounded-full shrink-0"
                />
              </>
            ) : (
              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
            <div className="min-w-0">
              {session?.user?.name && (
                <p className="text-sm font-medium text-foreground truncate">{session.user.name}</p>
              )}
              {session?.user?.email && (
                <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:border-destructive hover:text-destructive transition-colors shrink-0"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        {/* Tab switcher */}
        <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-secondary">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-md text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "setup" && <DefaultsForm settings={settings} updateSettings={updateSettings} />}

        {tab === "monthly" && (
          <>
            <p className="text-xs text-muted-foreground -mt-2">Override income or budget percentages for this period only. All other months use your <button onClick={() => setTab("setup")} className="text-primary underline underline-offset-2">Setup</button> defaults.</p>
            <MonthForm
              key={month}
              month={month}
              settings={settings}
              paydayOfMonth={paydayOfMonth}
              updateSettings={updateSettings}
            />
          </>
        )}

        {tab === "bills" && <RecurringForm settings={settings} updateSettings={updateSettings} />}

        {tab === "sources" && <IncomeForm settings={settings} updateSettings={updateSettings} />}

        {tab === "rules" && <RulesForm rules={rules} updateRules={updateRules} />}

        <AppTour pageKey="settings" slides={SETTINGS_SLIDES} />

        {/* Replay guide */}
        <div className="mt-2 pt-4 border-t border-border">
          <button
            onClick={replayGuide}
            className="text-sm text-primary hover:underline"
          >
            Replay app guide
          </button>
          <p className="text-xs text-muted-foreground mt-0.5">Takes you to the dashboard and restarts the tour from the beginning.</p>
        </div>

      </div>
    </PageShell>
  );
}
