import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Monera",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground mb-10 inline-block">
          ← Back
        </Link>

        <h1 className="text-3xl font-serif text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 2026</p>

        <div className="flex flex-col gap-8 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-semibold text-base mb-2">Acceptance</h2>
            <p>
              By accessing or using Monera, you agree to these Terms of Service. If you do not agree,
              do not use the application.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Personal Use</h2>
            <p>
              Monera is provided for personal, non-commercial use. You may not use it in any manner
              that violates applicable laws or regulations, or that infringes on the rights of others.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Your Responsibility for Data</h2>
            <p>
              All data you import or enter into Monera is stored in your own Google Drive account.
              You are solely responsible for the security and management of your Google account and the
              files within it. We are not liable for any data loss, unauthorised access, or corruption
              that occurs in your Google Drive.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Google Permissions</h2>
            <p>
              By signing in, you grant Monera access to create and read files in your Google Drive
              under the <code className="bg-secondary px-1 py-0.5 rounded text-xs">drive.file</code> scope.
              You can revoke this access at any time from your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                Google Account permissions
              </a>. Revoking access will prevent the application from functioning.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">No Warranty</h2>
            <p>
              Monera is provided &quot;as is&quot; without warranty of any kind, express or implied.
              We do not guarantee uninterrupted, error-free operation or that the application will meet
              your specific requirements. Use it at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, we are not liable for any direct, indirect,
              incidental, or consequential damages arising from your use of Monera, including but not
              limited to data loss or financial decisions made based on information displayed in the app.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Changes to the Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue Monera at any time without notice.
              We may also update these Terms at any time. Continued use of the application after changes
              are posted constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2">Contact</h2>
            <p>
              For any questions regarding these Terms, contact us at{" "}
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
