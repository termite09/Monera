import { test, expect, alerts } from "./support/fixtures";
import { account } from "./support/data";

const csvListing = /drive\/v3\/files\?.*mimeType%3D%27text%2Fcsv%27/;
const serverError = { status: 500, headers: { "access-control-allow-origin": "*" }, body: "{}" };

test("a signed-in visitor skips the sign-in page", async ({ page, drive }) => {
  drive.seed(account());
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an expired Google token signs the user out", async ({ page, drive }) => {
  drive.seed(account());
  drive.unauthorized = true;
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

test("a Drive outage while loading offers a retry", async ({ page, drive }) => {
  drive.seed(account());
  await page.route(csvListing, (route) => route.fulfill(serverError));
  await page.goto("/dashboard");
  await expect(alerts(page)).toContainText("Google Drive is having trouble");

  await page.unroute(csvListing);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(alerts(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Safe to spend: €612.01. Show details" })).toBeVisible();
});

test("setup that can't reach Drive explains and retries", async ({ page }) => {
  const anyListing = /drive\/v3\/files\?/;
  await page.route(anyListing, (route) => route.fulfill(serverError));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Setup didn't finish" })).toBeVisible();

  await page.unroute(anyListing);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "When do you get paid?" })).toBeVisible();
});

test("settings that can't be read block the app instead of falling back to defaults", async ({ page, drive }) => {
  const seeded = account();
  drive.seed(seeded);
  drive.failingDownloads.add("settings.json");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Couldn't load your settings" })).toBeVisible();
  // Never the first-run setup, which would save defaults over the real settings.
  await expect(page.getByRole("heading", { name: "When do you get paid?" })).toBeHidden();

  drive.failingDownloads.clear();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Safe to spend: €612.01. Show details" })).toBeVisible();
  expect(drive.appFile("settings")).toMatchObject(seeded.settings);
});

test("folder ids remembered from an earlier visit are replaced when they've gone", async ({ page, drive }) => {
  drive.seed(account());
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Safe to spend: €612.01. Show details" })).toBeVisible();

  // The folder is deleted and set up again, so every remembered id is stale.
  drive.clear();
  drive.seed(account());
  await page.reload();
  await expect(page.getByRole("button", { name: "Safe to spend: €612.01. Show details" })).toBeVisible();
  expect(drive.folders().filter((f) => f === "Monera")).toHaveLength(1);
});

test("going offline says the numbers are the last ones loaded", async ({ page, drive, context }) => {
  drive.seed(account());
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /^Safe to spend: / })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText("You're offline. Showing what was last loaded.")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("You're offline. Showing what was last loaded.")).toBeHidden();
});

test("the sidebar moves between every section", async ({ page, drive }) => {
  drive.seed(account());
  await page.goto("/dashboard");
  const nav = page.getByRole("complementary").getByRole("navigation", { name: "Main" });
  for (const [label, heading] of [["Transactions", "Transactions"], ["Insights", "Insights"], ["Statements", "Statements"], ["Settings", "Settings"]]) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});
