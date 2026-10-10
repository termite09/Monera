import { test, expect, type Page } from "./support/fixtures";
import { account } from "./support/data";

async function openTab(page: Page, tab: string) {
  await page.getByRole("tab", { name: tab }).click();
  await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
}

test.describe("insights", () => {
  test.beforeEach(async ({ page, drive }) => {
    drive.seed(account());
    await page.goto("/insights");
    await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  });

  test("overview compares this period with last period up to the same day", async ({ page }) => {
    await expect(page.getByText("Savings rate")).toBeVisible();
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    await expect(page.getByText("Target 20%")).toBeVisible();

    await expect(page.getByText("Last period, same day")).toBeVisible();
    // May 1–15: Lidl 40, Netflix 12.99, Wolt 20. June 1–15: 187.99.
    await expect(page.getByLabel("Up €10.00, worse than last period")).toBeVisible(); // Needs 40 → 50
    await expect(page.getByLabel("Up €105.00, worse than last period")).toBeVisible(); // Wants 32.99 → 137.99
    await expect(page.getByLabel("Up €115.00, worse than last period")).toBeVisible(); // Total 72.99 → 187.99
  });

  test("merchants shows where the money went, and hides a place without changing totals", async ({ page, drive }) => {
    await openTab(page, "Merchants");
    await expect(page.getByText("Every place you spent money this period.")).toBeVisible();
    const places = page.getByRole("button", { expanded: false }).filter({ hasText: /€/ });
    await expect(places).toHaveText([/^Zara.*€100\.00/, /^Lidl.*€50\.00/, /^Wolt.*€25\.00/, /^Netflix.*€12\.99/]);

    await page.getByRole("button", { name: /^Zara/ }).click();
    await expect(page.getByText("12 Jun 2026")).toBeVisible();

    await page.getByRole("button", { name: "Hide Lidl from this list" }).click();
    await expect(page.getByRole("button", { name: /^Lidl/ })).toBeHidden();
    await expect(page.getByRole("button", { name: "Show hidden (1)" })).toBeVisible();
    await expect.poll(() => drive.appFile<{ hiddenMerchants: string[] }>("settings").hiddenMerchants).toEqual(["Lidl"]);

    await page.getByRole("button", { name: "Show hidden (1)" }).click();
    await expect(page.getByRole("button", { name: /^Lidl/ })).toBeVisible();
  });

  test("subscriptions lists your bills and the regular charges Monera found", async ({ page, drive }) => {
    await openTab(page, "Subscriptions");
    await expect(page.getByText("Due on the 20th")).toBeVisible();
    await expect(page.getByText("paid 3 times since Mar")).toBeVisible();

    const netflix = page.getByRole("button", { name: /^Netflix Monthly/ });
    await expect(netflix).toContainText("Monthly · seen in 4 months · last 5 Jun 2026");
    await expect(netflix).toContainText("~€12.99");
    await netflix.click();
    await expect(page.getByText("across 4 charges so far")).toBeVisible();

    await page.getByRole("button", { name: "Netflix isn't a subscription — hide it" }).click();
    await expect(page.getByText("No recurring subscriptions detected yet.")).toBeVisible();
    await expect.poll(() => drive.appFile<{ excludedSubscriptions: string[] }>("settings").excludedSubscriptions).toEqual(["Netflix"]);
  });

  test("year shows spending by pay period and opens one on the dashboard", async ({ page }) => {
    await openTab(page, "Year");
    // Netflix Mar–Jun, May and June shopping, and rent for Mar–May (June's isn't due yet).
    await expect(page.getByText("€2,686.96")).toBeVisible();
    await page.getByRole("button", { name: /^Pay period May 2026: €872\.99 spent/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Past pay period · ended Sunday 31 May")).toBeVisible();
  });

  test("the period arrows only show where they apply", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Previous pay period" })).toBeVisible();
    await openTab(page, "Year");
    await expect(page.getByRole("button", { name: "Previous pay period" })).toBeHidden();
  });
});

test("the old year overview address opens the Year tab", async ({ page, drive }) => {
  drive.seed(account());
  await page.goto("/year-overview");
  await expect(page).toHaveURL(/\/insights\?tab=year$/);
  await expect(page.getByRole("tab", { name: "Year" })).toHaveAttribute("aria-selected", "true");
});
