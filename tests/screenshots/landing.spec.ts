/**
 * Captures the landing-page screenshots from the real app with a made-up
 * account (see demo.ts). Run with `npm run screenshots`; not part of the e2e suite.
 */
import { test, expect, type Page } from "../e2e/support/fixtures";
import { demoAccount } from "./demo";

async function openDashboard(page: Page) {
  await page.goto("/dashboard");
  // The chart's takeaway is the last thing to render.
  await expect(page.getByText(/cost you the most this period/)).toBeVisible();
  await page.waitForTimeout(500);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1492, height: 1000 }, deviceScaleFactor: 2 });

  test("dashboard", async ({ page, drive }) => {
    drive.seed(demoAccount());
    await openDashboard(page);
    await page.screenshot({ path: "public/screenshot-dashboard-v6.png" });
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("dashboard", async ({ page, drive }) => {
    drive.seed(demoAccount());
    await openDashboard(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "public/screenshot-dashboard-mobile-v6.png" });
  });
});
