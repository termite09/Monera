"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
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
    title: "Bills — recurring payments",
    body: "Add subscriptions and fixed bills you pay every month — rent, Netflix, gym. Monera uses these to show your committed spending and flag missing payments.",
  },
  {
    title: "Sources — income detection",
    body: "Tell Monera your employer name so it can identify your salary in your statement. You can also set keywords to detect transfers between your own accounts and exclude them from spending.",
  },
  {
    title: "Rules — auto-categorisation",
    body: "Rules map merchant names to categories automatically. Monera adds rules as you categorise transactions, so over time your uploads need less manual work.",
  },
];

type Tab = "setup" | "monthly" | "bills" | "sources" | "rules";

export default function SettingsPage() {
  const router = useRouter();
  const { month, setMonth, settings, rules, isLoading, updateSettings, updateRules } = useAppData();
  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  const [tab, setTab] = useState<Tab>("setup");

  const replayGuide = useCallback(async () => {
    await updateSettings({ ...settings, tourPages: {} });
    router.push("/dashboard");
  }, [settings, updateSettings, router]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "setup", label: "Setup" },
    { id: "monthly", label: "Monthly" },
    { id: "bills", label: "Bills" },
    { id: "sources", label: "Sources" },
    { id: "rules", label: "Rules" },
  ];

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-5">
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
