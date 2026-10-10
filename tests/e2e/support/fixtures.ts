import { test as base, expect, type Page } from "@playwright/test";
import { FakeDrive } from "./fakeDrive";
import { signIn } from "./session";
import { E2E_NOW } from "./env";

interface Fixtures {
  /**
   * A fresh, empty fake Google Drive, wired into every page automatically so no
   * test can reach the real Google APIs. Seed it before navigating.
   */
  drive: FakeDrive;
  /** A page with the clock fixed at E2E_NOW and the test user signed in. */
  page: Page;
}

// Fixture callbacks name their hand-off `provide`, not Playwright's usual `use`,
// so React's hooks lint rule doesn't mistake it for React.use().
export const test = base.extend<Fixtures>({
  drive: [
    async ({ page }, provide) => {
      const drive = new FakeDrive();
      await drive.install(page);
      await provide(drive);
    },
    { auto: true },
  ],
  page: async ({ page, context }, provide) => {
    await page.clock.setFixedTime(new Date(E2E_NOW));
    await signIn(context);
    await provide(page);
  },
});

/** A page with the clock fixed but nobody signed in. */
export const signedOutTest = base.extend<{ page: Page }>({
  page: async ({ page }, provide) => {
    await page.clock.setFixedTime(new Date(E2E_NOW));
    await provide(page);
  },
});

export { expect };
export type { Page };

/** Alerts with something in them — Next.js keeps an empty route announcer with the alert role. */
export function alerts(page: Page) {
  return page.getByRole("alert").filter({ hasText: /\S/ });
}
