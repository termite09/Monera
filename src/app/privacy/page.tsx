import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground mb-10 inline-block">
          ← Back
        </Link>

        <h1 className="text-3xl font-serif text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 2026</p>

        <div className="flex flex-col gap-8 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-semibold text-base mb-2">Overview</h2>
            <p>
              Monera is a personal finance application that helps you track and understand your spending.
              This Privacy Policy explains what information we handle and how.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Google Sign-In and Google User Data</h2>
            <p className="mb-3">
              Monera uses Google OAuth to authenticate you. When you sign in, Google provides the
              following data. Below is a precise description of each item, its purpose, and how it
              is handled:
            </p>
            <ul className="flex flex-col gap-3 list-none">
              <li>
                <span className="font-medium">Email address</span> — used as a unique identifier
                to route Google Drive API calls to the correct user&apos;s storage folder. It is
                never stored on Monera servers and is not shared with any third party.
              </li>
              <li>
                <span className="font-medium">Name</span> — received in the authentication
                response but not displayed or used by the application.
              </li>
              <li>
                <span className="font-medium">Profile picture</span> — received in the
                authentication response but not displayed or used by the application.
              </li>
              <li>
                <span className="font-medium">OAuth access token</span> — used to make
                authenticated requests to the Google Drive API on your behalf (reading, writing,
                creating, and deleting files within the Monera folder only). Stored exclusively in
                a secure, server-side HttpOnly cookie and never exposed to JavaScript or
                transmitted to third parties.
              </li>
              <li>
                <span className="font-medium">OAuth refresh token</span> — stored in the same
                HttpOnly cookie to automatically renew the access token when it expires, so you
                do not need to sign in again. Used only server-side; never exposed to the browser
                or shared with any third party.
              </li>
            </ul>
            <p className="mt-3">
              We do not have access to any Google account data beyond what is described above.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Your Data Lives in Your Google Drive</h2>
            <p className="mb-3">
              All financial data — imported statements, categories, settings, and manual
              transactions — is stored in a private{" "}
              <code className="bg-secondary px-1 py-0.5 rounded text-xs">Monera/</code> folder in
              your own Google Drive. Monera requests only the{" "}
              <code className="bg-secondary px-1 py-0.5 rounded text-xs">drive.file</code> scope,
              which limits access strictly to files the app itself created. We cannot read the rest
              of your Drive.
            </p>
            <p className="mb-2">Specifically, Monera performs the following Drive operations:</p>
            <ul className="flex flex-col gap-1 list-disc list-inside text-muted-foreground">
              <li>Creates and maintains a <code className="bg-secondary px-1 py-0.5 rounded text-xs">Monera/</code> folder with subfolders <code className="bg-secondary px-1 py-0.5 rounded text-xs">revolut-exports/</code> and <code className="bg-secondary px-1 py-0.5 rounded text-xs">app-data/</code></li>
              <li>Reads and writes JSON data files: transaction records, category overrides, settings, category rules, exclusions, and a parse cache</li>
              <li>Uploads CSV bank statement files you import into the app</li>
              <li>Deletes files when you remove data within the app</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">No Server-Side Database</h2>
            <p>
              Monera does not operate a backend database. Your financial data never passes through
              or is stored on Monera servers. The application server only handles authentication
              and serves the web application — it does not persist any personal or financial
              information.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Cookies and Sessions</h2>
            <p>
              Monera uses a secure, server-side HttpOnly session cookie to keep you signed in.
              This cookie contains your Google OAuth access token, refresh token, and token expiry
              time — used solely to authenticate Drive API calls on your behalf. It is never
              exposed to JavaScript and is cleared when you sign out.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Data Caching in Your Browser</h2>
            <p className="mb-3">
              Transaction data fetched from your Google Drive is held only in your browser&apos;s
              memory during your session (using TanStack Query) so the app does not have to
              re-fetch it as you navigate. It is not written to persistent storage and is
              discarded when you refresh the page, close the tab, or sign out.
            </p>
            <p>
              Monera also stores your transaction-list filter preferences (search text, selected
              category, date range, and sort order) in your browser&apos;s sessionStorage, which
              clears automatically when you close the tab. This contains no financial data and is
              never transmitted to Monera servers.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Data Retention and Sign-Out</h2>
            <p>
              When you sign out, the session cookie — containing your OAuth access and refresh
              tokens — is cleared immediately, and the in-memory transaction cache is discarded.
              No personal data is retained on Monera servers after sign-out. Your financial data
              remains in your own Google Drive and can be deleted there at any time.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Analytics</h2>
            <p>
              Monera uses Vercel Analytics to collect anonymous, aggregated page-view and
              performance data (such as page load times and navigation paths). This service does
              not receive your name, email address, financial data, or any other personally
              identifiable information.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Google API Limited Use Policy</h2>
            <p>
              Monera&apos;s use and transfer to any other app of information received from Google
              APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="underline underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Specifically: Google user data is used
              solely to provide and improve the features of Monera that are visible to you. It is
              not used for serving advertisements, is not sold or shared with third parties for
              any purpose, and is not used for any purpose that is unrelated to the app&apos;s
              core function of helping you track your personal finances.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Data Sharing</h2>
            <p>
              We do not sell, share, or transfer your personal or financial data to any third
              party. The only external services involved are Google (authentication and Drive
              storage, under Google&apos;s own privacy terms) and Vercel Analytics (anonymous
              usage metrics only, as described above).
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
