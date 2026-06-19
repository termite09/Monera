import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Monera — Personal Finance",
  description: "Track your spending with data stored entirely in your own Google Drive. No server, no database, no third-party access to your finances.",
};

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto w-full">
        <span className="font-serif text-xl text-foreground tracking-tight">Monera</span>
        <Link
          href="/login"
          className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-2xl mx-auto w-full gap-6">
        <h1 className="text-5xl font-serif text-foreground tracking-tight leading-tight">
          Finally know where<br />your money goes.
        </h1>
        <p className="text-base text-muted-foreground max-w-md leading-relaxed">
          Import your Revolut statement and get a clear breakdown of your spending — budgets, categories, and insights, all in one place.
          Your data is stored privately in <strong className="text-foreground font-medium">your own Google Drive</strong>. We never see it.
        </p>

        <Link
          href="/login"
          className="mt-2 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Get started — it&apos;s free
        </Link>

        {/* Feature grid */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left w-full">
          {[
            {
              title: "Your data stays yours",
              body: "Nothing is stored on our servers. Your finances live in a private folder in your own Google Drive.",
            },
            {
              title: "Budgets that match real life",
              body: "Periods run payday-to-payday, not calendar months. Set your payday once and budgets just work.",
            },
            {
              title: "Spending that makes sense",
              body: "Transactions are categorised automatically. Override any one and the app remembers your preference.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col gap-2"
            >
              <p className="text-sm font-semibold text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground/60 flex items-center justify-center gap-4">
        <Link href="/privacy" className="underline underline-offset-2 hover:text-muted-foreground">Privacy Policy</Link>
        <Link href="/terms" className="underline underline-offset-2 hover:text-muted-foreground">Terms of Service</Link>
      </footer>
    </div>
  );
}
