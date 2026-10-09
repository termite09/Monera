import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Download,
  Upload,
  PieChart,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const GITHUB_URL = "https://github.com/termite09/Monera";

// Single source of truth for the FAQ — rendered on the page AND emitted as
// FAQPage JSON-LD below, so the two can never drift apart.
const FAQ = [
  {
    q: "Is my data really private?",
    a: "Yes. There's no Monera server or database. Your data is written only to your own Google Drive via the drive.file scope, which can't see the rest of your Drive. It's open-source, so you can verify it.",
  },
  {
    q: "Does it only work with Revolut?",
    a: "Today, yes. That focus is why the import and budgets fit Revolut life so well. More banks are on the roadmap.",
  },
  {
    q: "Is it free?",
    a: "Yes, and there's no catch. Most free finance apps make money from your data. Monera can't, because we never see it. There's no account on our side. Everything you can use today stays free; if paid extras ever arrive, they'll be optional.",
  },
  {
    q: "Why does it need Google Drive access?",
    a: "That's where your private folder lives. Granting access is how your data gets saved to your account. Monera only ever sees files it creates.",
  },
  {
    q: "Is it open-source?",
    a: "Yes, under AGPL v3. You can read every line of the code.",
  },
];

const STEPS = [
  {
    icon: Download,
    title: "Export from Revolut",
    body: "Download a CSV or Excel statement from the Revolut app.",
  },
  {
    icon: Upload,
    title: "Add it to Monera",
    body: "Drop the file in. You see what was found before anything is saved to your Drive.",
  },
  {
    icon: PieChart,
    title: "See where it went",
    body: "Budgets that run payday to payday, not from the 1st of the month. Categories, subscriptions, and plain-English insights.",
  },
];

// Comparison cells: `true` → check, `false` → dim cross, string → text.
const COMPARISON: { feature: string; monera: boolean | string; emma: boolean | string; snoop: boolean | string; revolut: boolean | string }[] = [
  { feature: "Payday-to-payday budgets", monera: true, emma: "Calendar month", snoop: "Calendar month", revolut: "Calendar month" },
  { feature: "Where your data lives", monera: "Your Google Drive", emma: "Emma's servers", snoop: "Snoop's servers", revolut: "Revolut's servers" },
  { feature: "Bank login / Open Banking required", monera: false, emma: true, snoop: true, revolut: "Built-in" },
  { feature: "Price", monera: "Free", emma: "Free – £14.99/mo", snoop: "Free / £47.99/yr", revolut: "Free" },
  { feature: "Open-source", monera: true, emma: false, snoop: false, revolut: false },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={18} className="text-primary mx-auto" aria-label="Yes" />;
  if (value === false) return <X size={18} className="text-muted-foreground mx-auto" aria-label="No" />;
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Monera",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  url: "https://mymonera.com",
  description:
    "Private budgeting for Revolut — import your statement and get payday-aware budgets and insights, stored in your own Google Drive.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <span className="font-serif text-2xl text-foreground tracking-tight">Monera</span>
        <div className="flex items-center gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-1.5"
          >
            Open-source
          </a>
          <Link
            href="/login"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero */}
        <section className="px-6 pt-16 pb-12 text-center max-w-2xl mx-auto w-full flex flex-col items-center gap-6">
          <h1 className="text-5xl font-serif text-foreground tracking-tight leading-tight text-balance">
            Finally know where your money goes.
          </h1>
          <p className="text-base text-muted-foreground max-w-md leading-relaxed">
            Import your Revolut statement and get a clear breakdown of your spending: budgets,
            categories, and insights, all in one place. Your data stays in{" "}
            <strong className="text-foreground font-medium">your own Google Drive</strong>. We never see it.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link href="/login">Get started, it&apos;s free</Link>
          </Button>
          <p className="text-xs text-muted-foreground tracking-wide">
            Free · Open-source · No bank login
          </p>
        </section>

        {/* Trust strip */}
        <section className="px-6 py-4 border-y border-border/60 bg-card/40">
          <p className="max-w-md mx-auto text-center text-sm text-muted-foreground">
            <strong className="text-foreground font-medium">No backend. No database. No bank login.</strong>{" "}
            Your finances live in a private folder in your Google Drive, and Monera only ever sees the files
            it creates.{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-primary">
              View the source on GitHub →
            </a>
          </p>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-serif text-foreground text-center mb-10 text-balance">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
                <span className="text-xs font-mono font-medium text-primary tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex items-center gap-2">
                  <s.icon size={14} className="text-muted-foreground shrink-0" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          {/* Phones get a phone-sized capture; the desktop one is unreadable at that width. */}
          <div className="mt-10 mx-auto max-w-72 rounded-xl border border-border overflow-hidden sm:hidden">
            <Image
              src="/screenshot-dashboard-mobile-v4.png"
              alt="Monera on a phone: €563.38 safe to spend, about €37.55 a day until payday"
              className="w-full"
              width={780}
              height={1688}
            />
          </div>
          <div className="mt-10 rounded-xl border border-border overflow-hidden hidden sm:block">
            <Image
              src="/screenshot-dashboard-v4.png"
              alt="Monera dashboard: €563.38 safe to spend, about €37.55 a day until payday, with budget progress and spending by day"
              className="w-full"
              width={2984}
              height={2000}
            />
          </div>
        </section>

        {/* Privacy / open-source band */}
        <section className="px-6 py-16 bg-card/40 border-y border-border/60">
          <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
            <h2 className="text-2xl font-serif text-foreground text-balance">
              Your money is nobody&apos;s business but yours.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              There&apos;s no Monera server and no database. Your data is written only to a private{" "}
              <code className="font-mono text-xs text-foreground bg-secondary rounded px-1 py-0.5">Monera/</code> folder in your own Google Drive,
              using the minimal <code className="font-mono text-xs text-foreground bg-secondary rounded px-1 py-0.5">drive.file</code> permission that
              can&apos;t even see the rest of your Drive. It&apos;s open-source under AGPL, so you don&apos;t have to
              take our word for it.
            </p>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground underline underline-offset-2 hover:text-primary">
              Read the code →
            </a>
          </div>
        </section>

        {/* Comparison */}
        <section className="px-6 py-16 max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-serif text-foreground text-center mb-10 text-balance">How Monera compares</h2>
          <p className="sm:hidden text-xs text-muted-foreground text-center -mt-6 mb-4">Swipe sideways to see every app.</p>
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">Monera compared with Emma, Snoop and Revolut&apos;s built-in budgeting</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="text-left font-normal text-muted-foreground py-3 pr-3 w-40"><span className="sr-only">Feature</span></th>
                  <th scope="col" className="text-center font-semibold text-foreground py-3 px-3">Monera</th>
                  <th scope="col" className="text-center font-normal text-muted-foreground py-3 px-3">Emma</th>
                  <th scope="col" className="text-center font-normal text-muted-foreground py-3 px-3">Snoop</th>
                  <th scope="col" className="text-center font-normal text-muted-foreground py-3 px-3">Revolut built-in</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-border/60">
                    <th scope="row" className="py-3 pr-3 text-left font-normal text-foreground">{row.feature}</th>
                    <td className="py-3 px-3 text-center bg-primary/3"><Cell value={row.monera} /></td>
                    <td className="py-3 px-3 text-center"><Cell value={row.emma} /></td>
                    <td className="py-3 px-3 text-center"><Cell value={row.snoop} /></td>
                    <td className="py-3 px-3 text-center"><Cell value={row.revolut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground text-center max-w-sm mx-auto">
            Considering YNAB, Monarch, or Copilot? Great apps, but US-focused and paid. Not ideal for Revolut/EU users.
          </p>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 bg-card/40 border-y border-border/60">
          <div className="max-w-2xl mx-auto w-full">
            <h2 className="text-2xl font-serif text-foreground text-center mb-10">Questions</h2>
            <div className="flex flex-col gap-6">
              {FAQ.map((f) => (
                <div key={f.q} className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">{f.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Close CTA */}
        <section className="px-6 py-20 text-center max-w-xl mx-auto w-full flex flex-col items-center gap-5">
          <h2 className="text-3xl font-serif text-foreground tracking-tight leading-tight text-balance">
            Know where your money goes — without giving it away.
          </h2>
          <Button asChild size="lg">
            <Link href="/login">Get started, it&apos;s free</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            No bank login. No subscription. Your data stays in your Drive.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-4">
        <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>
        <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Service</Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">GitHub</a>
      </footer>

      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </div>
  );
}
