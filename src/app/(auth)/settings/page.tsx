"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogOut, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { useAppData } from "@/contexts/AppDataContext";
import { getPeriodLabel } from "@/lib/utils";
import { signOutAndClear } from "@/lib/session";
import { Segmented, TabPanel } from "@/components/ui/segmented";
import { PeriodForm } from "@/components/settings/PeriodForm";
import { DefaultsForm } from "@/components/settings/DefaultsForm";
import { RecurringForm } from "@/components/settings/RecurringForm";
import { RulesForm } from "@/components/settings/RulesForm";
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

type SettingsTab = "basics" | "period" | "bills" | "rules";

const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: "basics", label: "Basics" },
  { value: "period", label: "Period" },
  { value: "bills", label: "Bills" },
  { value: "rules", label: "Rules" },
];

/** The tab named in the URL. Older links used "setup", "monthly" and "sources". */
function tabFromParam(param: string | null): SettingsTab {
  if (param === "period" || param === "monthly") return "period";
  if (param === "bills" || param === "rules") return param;
  return "basics";
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const {
    periodKey, setPeriodKey, settings, settingsLoaded, rules, rulesLoaded, isLoading, txError, refetch,
    updateSettings, updateRules, structure,
  } = useAppData();
  const { paydayOfMonth } = settings;
  const [tab, setTab] = useState(() => tabFromParam(searchParams.get("tab")));

  const replayGuide = useCallback(async () => {
    await updateSettings({ ...settings, tourPages: {} });
    router.push("/dashboard");
  }, [settings, updateSettings, router]);

  // Forms copy settings into local state when they mount; remounting them once
  // the real settings arrive from Drive replaces the defaults they started with.
  const loadedKey = settingsLoaded ? "loaded" : "loading";

  return (
    <PageShell>
      {/* The period picker only matters on the Period tab; elsewhere it just distracts. */}
      <Header
        periodKey={periodKey}
        onPeriodChange={setPeriodKey}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        showPeriod={tab === "period"}
      />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-5 md:max-w-none md:px-6">
        {/* Account row — mobile only, always at the top */}
        <div className="md:hidden flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- referrerPolicy is required for Google avatars and is not supported by next/image
              <img src={session.user.image} alt="" referrerPolicy="no-referrer" className="size-9 rounded-full shrink-0" />
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
          <button type="button"
            onClick={signOutAndClear}
            className="flex items-center gap-1.5 px-3 min-h-11 rounded-lg border border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
          >
            <LogOut size={14} aria-hidden />
            Sign out
          </button>
        </div>

        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Settings</h1>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        <Segmented
          items={SETTINGS_TABS}
          value={tab}
          onChange={setTab}
          label="Settings sections"
          idPrefix="settings"
          className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-secondary"
          itemClassName="h-10 rounded-md text-sm"
        />

        {/* Every form stays mounted, so unsaved edits survive switching tabs. */}
        <TabPanel idPrefix="settings" value={tab}>
          <div hidden={tab !== "basics"}>
            <DefaultsForm key={loadedKey} settings={settings} updateSettings={updateSettings} />
          </div>

          <div hidden={tab !== "period"} className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground -mt-2">
              Only for <span className="font-medium text-foreground">{getPeriodLabel(periodKey, paydayOfMonth)}</span>. Other periods use{" "}
              <button type="button" onClick={() => setTab("basics")} className="text-primary underline underline-offset-2">Basics</button>.
            </p>
            <PeriodForm key={`${periodKey}-${loadedKey}`} periodKey={periodKey} settings={settings} updateSettings={updateSettings} />
          </div>

          <div hidden={tab !== "bills"}>
            <RecurringForm key={loadedKey} settings={settings} updateSettings={updateSettings} />
          </div>

          <div hidden={tab !== "rules"}>
            <RulesForm key={rulesLoaded ? "loaded" : "loading"} rules={rules} updateRules={updateRules} />
          </div>
        </TabPanel>

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
              className="tap-area inline-flex items-center gap-1.5 mt-2 text-sm text-primary underline underline-offset-2"
            >
              Open my Monera folder in Drive
              <ExternalLink size={13} aria-hidden />
            </a>
          </section>
        )}

        {/* Replay guide */}
        <div className="pt-4 border-t border-border">
          <button onClick={replayGuide} type="button" className="tap-area text-sm text-primary hover:underline">
            Replay app guide
          </button>
          <p className="text-xs text-muted-foreground mt-0.5">Restarts the tour on the dashboard.</p>
        </div>
      </div>
    </PageShell>
  );
}
