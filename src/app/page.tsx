import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Download,
  Upload,
  PieChart,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";

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
    a: "Today, yes — and that focus is why the import and budgets fit Revolut life so well. More banks are on the roadmap.",
  },
  {
    q: "Is it free?",
    a: "Yes, free and open-source. There's no account on our side and nothing to upsell.",
  },
  {
    q: "Why does it need Google Drive access?",
    a: "That's where your private folder lives — granting access is how your data gets saved to your account. Monera only ever sees files it creates.",
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
    title: "Import to Monera",
    body: "Drop the file in. Nothing leaves your machine until it's saved to your Drive.",
  },
  {
    icon: PieChart,
    title: "See where it went",
    body: "Payday-aware budgets, categories, subscriptions, and plain-English insights.",
  },
];

// Comparison cells: `true` → check, `false` → dim cross, string → text.
const COMPARISON: { feature: string; monera: boolean | string; revolut: boolean | string; ynab: boolean | string }[] = [
  { feature: "Payday-to-payday budgets", monera: true, revolut: "Calendar month", ynab: "Calendar / manual" },
  { feature: "Where your data lives", monera: "Your Google Drive", revolut: "Revolut's servers", ynab: "Their servers" },
  { feature: "Bank login required", monera: false, revolut: "It's your bank", ynab: true },
  { feature: "Price", monera: "Free", revolut: "Free", ynab: "Paid" },
  { feature: "Open-source", monera: true, revolut: false, ynab: false },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={18} className="text-green-600 mx-auto" aria-label="Yes" />;
  if (value === false) return <X size={18} className="text-muted-foreground/50 mx-auto" aria-label="No" />;
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
        <span className="font-serif text-xl text-foreground tracking-tight">Monera</span>
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
          <h1 className="text-5xl font-serif text-foreground tracking-tight leading-tight">
            Finally know where<br />your money goes.
          </h1>
          <p className="text-base text-muted-foreground max-w-md leading-relaxed">
            Import your Revolut statement and get a clear breakdown of your spending — budgets,
            categories, and insights, all in one place. Your data stays in{" "}
            <strong className="text-foreground font-medium">your own Google Drive</strong>. We never see it.
          </p>
          <Link
            href="/login"
            className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Get started — it&apos;s free
          </Link>
          <p className="text-xs text-muted-foreground/80 tracking-wide">
            Free · Open-source · No bank login
          </p>
        </section>

        {/* Trust strip */}
        <section className="px-6 py-4 border-y border-border/60 bg-card/40">
          <p className="max-w-3xl mx-auto text-center text-sm text-muted-foreground">
            <strong className="text-foreground font-medium">No backend. No database. No bank login.</strong>{" "}
            Your finances live in a private folder in your Google Drive — Monera only ever sees the files
            it creates.{" "}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-primary">
              View the source on GitHub →
            </a>
          </p>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 max-w-4xl mx-auto w-full">
          <h2 className="text-2xl font-serif text-foreground text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-card border border-border/60 rounded-2xl p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <s.icon size={18} />
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">Step {i + 1}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-border/60 overflow-hidden shadow-sm">
            <img
              src="/screenshot-dashboard.png"
              alt="Monera dashboard showing income, expenses, budget progress and spending by day"
              className="w-full"
              width={2984}
              height={1712}
            />
          </div>
        </section>

        {/* Privacy / open-source band */}
        <section className="px-6 py-16 bg-card/40 border-y border-border/60">
          <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
            <span className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck size={22} />
            </span>
            <h2 className="text-2xl font-serif text-foreground">
              Your money is nobody&apos;s business but yours.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Most budgeting apps ask you to link your bank and trust them with everything. Monera doesn&apos;t.
              There&apos;s no Monera server and no database — your data is written only to a private{" "}
              <code className="font-mono text-xs text-foreground">Monera/</code> folder in your own Google Drive,
              using the minimal <code className="font-mono text-xs text-foreground">drive.file</code> permission that
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
          <h2 className="text-2xl font-serif text-foreground text-center mb-10">How Monera compares</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-normal text-muted-foreground py-3 pr-3"></th>
                  <th className="text-center font-semibold text-foreground py-3 px-3">Monera</th>
                  <th className="text-center font-normal text-muted-foreground py-3 px-3">Revolut analytics</th>
                  <th className="text-center font-normal text-muted-foreground py-3 px-3">YNAB / Monarch</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-border/60">
                    <td className="py-3 pr-3 text-foreground">{row.feature}</td>
                    <td className="py-3 px-3 text-center bg-primary/3"><Cell value={row.monera} /></td>
                    <td className="py-3 px-3 text-center"><Cell value={row.revolut} /></td>
                    <td className="py-3 px-3 text-center"><Cell value={row.ynab} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 bg-card/40 border-y border-border/60">
          <div className="max-w-2xl mx-auto w-full">
            <h2 className="text-2xl font-serif text-foreground text-center mb-10">Questions</h2>
            <div className="flex flex-col gap-6">
              {FAQ.map((f) => (
                <div key={f.q} className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-foreground">{f.q}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Close CTA */}
        <section className="px-6 py-20 text-center max-w-xl mx-auto w-full flex flex-col items-center gap-5">
          <h2 className="text-3xl font-serif text-foreground tracking-tight leading-tight">
            Know where your money goes —<br />without giving it away.
          </h2>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Get started — it&apos;s free
          </Link>
          <p className="text-xs text-muted-foreground/80">
            No bank login. No subscription. Your data stays in your Drive.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground/60 flex items-center justify-center gap-4">
        <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground">Privacy Policy</Link>
        <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">Terms of Service</Link>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">GitHub</a>
      </footer>

      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </div>
  );
}
