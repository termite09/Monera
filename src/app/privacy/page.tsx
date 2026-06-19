import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Monera",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground mb-10 inline-block">
          ← Back
        </Link>

        <h1 className="text-3xl font-serif text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 2025</p>

        <div className="flex flex-col gap-8 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-semibold text-base mb-2">Overview</h2>
            <p>
              Monera is a personal finance application that helps you track and understand your spending.
              This Privacy Policy explains what information we handle and how.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Google Sign-In</h2>
            <p>
              Monera uses Google OAuth to authenticate you. When you sign in, Google provides us with
              your name, email address, and profile picture so we can identify your session. We do not
              store a password and we do not have access to any Google account data beyond what you
              explicitly authorise.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Your Data Lives in Your Google Drive</h2>
            <p>
              All financial data — imported statements, categories, settings, and manual transactions —
              is stored in a private <code className="bg-secondary px-1 py-0.5 rounded text-xs">Monera/</code> folder
              in your own Google Drive. Monera requests only the <code className="bg-secondary px-1 py-0.5 rounded text-xs">drive.file</code> scope,
              which limits access to files the app itself created. We cannot read the rest of your Drive.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">No Server-Side Database</h2>
            <p>
              Monera does not operate a backend database. Your financial data never passes through or
              is stored on Monera servers. The application server only handles authentication and serves
              the web application — it does not persist any personal or financial information.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Cookies and Sessions</h2>
            <p>
              Monera uses a secure, server-side HttpOnly session cookie to keep you signed in. This
              cookie contains your authentication token and session metadata only. It is never exposed
              to JavaScript and is cleared when you sign out.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Local Storage</h2>
            <p>
              To improve performance, Monera caches your transaction data in your browser&apos;s local
              storage using TanStack Query. This data stays on your device and is never transmitted to
              Monera servers.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Data Sharing</h2>
            <p>
              We do not sell, share, or transfer your personal or financial data to any third party.
              The only external service involved is Google, which provides authentication and Drive
              storage under Google&apos;s own privacy terms.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Contact</h2>
            <p>
              If you have questions about this policy, you can reach us at{" "}
              <a href="mailto:alex12-christou@hotmail.com" className="underline underline-offset-2">
                alex12-christou@hotmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
