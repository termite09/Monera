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

  test("merchants opens first and compares with last period up to the same day", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Merchants" })).toHaveAttribute("aria-selected", "true");
    // May 1–15: Lidl 40, Netflix 12.99, Wolt 20 = 72.99. June 1–15: 187.99.
    await expect(page.getByText("€187.99 spent so far · €115.00 more than this time last period")).toBeVisible();
  });

  test("the old Overview address opens Merchants", async ({ page }) => {
    await page.goto("/insights?tab=overview");
    await expect(page.getByRole("tab", { name: "Merchants" })).toHaveAttribute("aria-selected", "true");
  });

  test("merchants shows where the money went, and hides a place without changing totals", async ({ page, drive }) => {
    await openTab(page, "Merchants");
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
    await expect(page.getByText("€2,400.00 paid since Mar")).toBeVisible(); // rent, Mar–May

    const netflix = page.getByRole("button", { name: /^Netflix Last charged/ });
    await expect(netflix).toContainText("Last charged 5 Jun");
    await expect(netflix).toContainText("€12.99 a month");
    await expect(netflix).toContainText("€51.96 paid since Mar");
    await netflix.click();
    await expect(page.getByText("5 Mar 2026")).toBeVisible();

    await page.getByRole("button", { name: "Netflix isn't a subscription — hide it" }).click();
    await expect(page.getByText("No recurring subscriptions detected yet.")).toBeVisible();
    await expect.poll(() => drive.appFile<{ excludedSubscriptions: string[] }>("settings").excludedSubscriptions).toEqual(["Netflix"]);
  });

  test("year shows spent and saved by pay period and opens one on the dashboard", async ({ page }) => {
    await openTab(page, "Year");
    // Netflix Mar–Jun, May and June shopping, and rent for Mar–May (June's isn't due yet).
    await expect(page.getByText("€2,686.96")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay period June 2026: €187\.99 spent, €0\.00 saved so far/ })).toBeVisible();
    await page.getByRole("button", { name: /^Pay period May 2026: €872\.99 spent, €0\.00 saved\./ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Past pay period · ended Sunday 31 May")).toBeVisible();
  });

  test("the period arrows only show where they apply", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Previous pay period" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous year" })).toBeHidden();
    await openTab(page, "Year");
    await expect(page.getByRole("button", { name: "Previous pay period" })).toBeHidden();
    // Year swaps them for year arrows in the same place.
    await expect(page.getByText("2026", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Previous year" }).click();
    await expect(page.getByText("2025", { exact: true })).toBeVisible();
    await expect(page.getByText("Spent this year").locator("..").getByText("€0.00")).toBeVisible();
  });
});

test("the old year overview address opens the Year tab", async ({ page, drive }) => {
  drive.seed(account());
  await page.goto("/year-overview");
  await expect(page).toHaveURL(/\/insights\?tab=year$/);
  await expect(page.getByRole("tab", { name: "Year" })).toHaveAttribute("aria-selected", "true");
});
