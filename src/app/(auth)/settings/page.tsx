"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { useAppData } from "@/contexts/AppDataContext";
import { cn, getMonthLabel } from "@/lib/utils";
import { MonthForm } from "@/components/settings/MonthForm";
import { DefaultsForm } from "@/components/settings/DefaultsForm";
import { RecurringForm } from "@/components/settings/RecurringForm";
import { RulesForm } from "@/components/settings/RulesForm";
import { IncomeForm } from "@/components/settings/IncomeForm";
import { AppTour } from "@/components/onboarding/AppTour";

const SETTINGS_SLIDES = [
  {
    title: "Basics",
    body: "Your payday, your pay, and how you split it between Needs, Wants and Savings. Every pay period uses these.",
  },
  {
    title: "One-off changes",
    body: "Got a bonus or an unusual month? Use Period to change the pay or split for just that pay period.",
  },
  {
    title: "Bills and rules",
    body: "Add regular bills paid from other accounts, and teach Monera which shops belong in which category.",
  },
];

type Tab = "setup" | "monthly" | "bills" | "sources" | "rules";

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { month, setMonth, settings, rules, isLoading, txError, refetch, updateSettings, updateRules, structure } = useAppData();
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
    { id: "setup", label: "Basics" },
    { id: "monthly", label: "Period" },
    { id: "bills", label: "Bills" },
    { id: "sources", label: "Income" },
    { id: "rules", label: "Rules" },
  ];
  const periodLabel = getMonthLabel(month, paydayOfMonth);

  return (
    <PageShell>
      {/* The period picker only matters on the Period tab; elsewhere it just distracts. */}
      <Header
        month={month}
        onMonthChange={setMonth}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        navLabel={tab === "monthly" ? undefined : "Settings"}
      />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-5 md:max-w-none md:px-6">
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
        <div role="tablist" aria-label="Settings sections" className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-secondary">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-md text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-card text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "setup" && <DefaultsForm settings={settings} updateSettings={updateSettings} />}

        {tab === "monthly" && (
          <>
            <p className="text-sm text-muted-foreground -mt-2">
              Change your pay or budget split for <span className="font-medium text-foreground">{periodLabel}</span> only. Use the arrows at the top to pick another pay period. Every other period uses your{" "}
              <button type="button" onClick={() => setTab("setup")} className="text-primary underline underline-offset-2">Basics</button>.
            </p>
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

        {/* Your data — make the privacy claim checkable from inside the app */}
        {structure?.rootId && (
          <section aria-labelledby="your-data" className="mt-2 pt-4 border-t border-border">
            <h2 id="your-data" className="text-sm font-semibold text-foreground">Your data</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-[60ch]">
              Everything Monera saves lives in one folder in your Google Drive. Nothing is stored anywhere else. Delete the folder at any time to remove all of it.
            </p>
            <a
              href={`https://drive.google.com/drive/folders/${structure.rootId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary underline underline-offset-2"
            >
              Open my Monera folder in Drive
              <ExternalLink size={13} aria-hidden />
            </a>
          </section>
        )}

        {/* Replay guide */}
        <div className="pt-4 border-t border-border">
          <button
            onClick={replayGuide}
            type="button"
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
