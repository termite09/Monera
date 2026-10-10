import { test, expect } from "./support/fixtures";
import { account } from "./support/data";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page, drive }) => {
    drive.seed(account());
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /^Safe to spend: / })).toBeVisible();
  });

  test("answers what's safe to spend before payday", async ({ page }) => {
    await expect(page.getByText("Today · Monday 15 June")).toBeVisible();
    await expect(page.getByRole("button", { name: "Safe to spend: €612.01. Show details" })).toBeVisible();
    await expect(page.getByText("About €38.25 a day for the next 16 days, until payday on Wednesday 1 July.")).toBeVisible();
    await expect(page.getByText("Statement up to 12 Jun")).toBeVisible();
  });

  test("shows income, spending and savings for the pay period", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Income: +€2,000.00. Show details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Spent: €187.99. Show details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Saved: €0.00. Show details" })).toBeVisible();
  });

  test("budget circles add up to safe to spend", async ({ page }) => {
    // Needs left (150) + Wants left (462.01) = Safe to spend (612.01).
    await expect(page.getByRole("button", { name: "Needs: €150.00 left of €1,000.00, after €800.00 in bills due. Show transactions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wants: €462.01 left of €600.00. Show transactions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Savings: €0.00 saved of a €400.00 target. Show transactions" })).toBeVisible();
  });

  test("lists the bills still to come", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Upcoming bills" })).toBeVisible();
    await expect(page.getByText("€800.00 due by payday, 1 Jul")).toBeVisible();
    await expect(page.getByText("Regular bill")).toBeVisible();
    await expect(page.getByText("Sat 20 Jun")).toBeVisible();
  });

  test("explains safe to spend line by line", async ({ page }) => {
    await page.getByRole("button", { name: /^Safe to spend: / }).click();
    const sheet = page.getByRole("dialog", { name: "Safe to spend" });
    await expect(sheet.getByText("€2,000.00")).toBeVisible();
    await expect(sheet.getByText("− €187.99")).toBeVisible();
    await expect(sheet.getByText("− €800.00").first()).toBeVisible();
    await expect(sheet.getByText("− €400.00")).toBeVisible();
    await expect(sheet.getByText("20 Jun · Regular bill")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("opens the transactions behind each figure", async ({ page }) => {
    await page.getByRole("button", { name: /^Income: / }).click();
    const income = page.getByRole("dialog", { name: "Income this period" });
    await expect(income.getByText("Salary ACME Ltd")).toBeVisible();
    await expect(income.getByText("Pay", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /^Wants: / }).click();
    const expenses = page.getByRole("dialog", { name: "Expenses this period" });
    await expect(expenses.getByText("Zara")).toBeVisible();
    await expect(expenses.getByText("Wolt")).toBeVisible();
    await expect(expenses.getByText("Lidl")).toBeHidden(); // Needs stays collapsed
    await page.keyboard.press("Escape");
  });

  test("shows which weekday costs the most and what was bought", async ({ page }) => {
    await expect(page.getByText("No spending this week")).toBeVisible();

    await page.getByRole("radio", { name: "Period" }).click();
    await expect(page.getByText("Fridays cost you the most this period: €112.99.")).toBeVisible();

    await page.getByRole("button", { name: "Friday: €112.99 spent. Show transactions" }).click();
    const sheet = page.getByRole("dialog", { name: "Fri spending" });
    await expect(sheet.getByText("Zara")).toBeVisible();
    await expect(sheet.getByText("Netflix")).toBeVisible();
    await expect(sheet.getByText("Net spent")).toBeVisible();
  });

  test("the month chart steps through calendar months", async ({ page }) => {
    await page.getByRole("radio", { name: "Month" }).click();
    const picker = page.getByRole("button", { name: "Previous month" }).locator("..");
    await expect(picker.getByText("June 2026", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(picker.getByText("May 2026", { exact: true })).toBeVisible();
    await expect(page.getByText(/cost you the most in May/)).toBeVisible();
  });

  test("past pay periods show what was left instead", async ({ page }) => {
    await page.getByRole("button", { name: "Previous pay period" }).click();
    await expect(page.getByText("Past pay period · ended Sunday 31 May")).toBeVisible();
    // May: 2000 in, 72.99 spent, 800 rent → 1,127.01 left.
    await expect(page.getByRole("button", { name: "Remaining: €1,127.01. Show details" })).toBeVisible();
    await expect(page.getByText("This pay period has ended.")).toBeVisible();
  });

  test("future pay periods say they haven't started", async ({ page }) => {
    await page.getByRole("button", { name: "Next pay period" }).click();
    await expect(page.getByText("Upcoming pay period · starts Wednesday 1 July")).toBeVisible();
    await expect(page.getByText("This pay period hasn't started yet.").first()).toBeVisible();
  });
});

test.describe("dashboard states", () => {
  test("opens on the latest statement's period when none covers today's yet", async ({ page, drive }) => {
    const data = account();
    drive.seed({ ...data, statements: [{ name: "old.csv", csv: data.statements[0].csv.split("\n").filter((l) => !l.includes("2026-06")).join("\n") }] });
    await page.goto("/dashboard");
    // The statement ends 10 May, so May's figures show instead of an empty dashboard.
    await expect(page.getByText("Past pay period · ended Sunday 31 May")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Remaining: / })).toBeVisible();

    // Today's period still asks for its statement.
    await page.getByRole("button", { name: "Next pay period" }).click();
    await expect(page.getByText(/Add this pay period's statement to see what's safe to spend/)).toBeVisible();
    await expect(page.getByText("Your latest statement ends 10 May.")).toBeVisible();
    await page.getByRole("link", { name: "Add this period's statement" }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("an account with no data is guided to import", async ({ page, drive }) => {
    const data = account({ settings: { recurringPayments: [] } });
    drive.seed({ ...data, statements: [] });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "No transactions yet" })).toBeVisible();
    await page.getByRole("link", { name: "Import a statement" }).click();
    await expect(page).toHaveURL(/\/upload$/);
  });

  test("asks to confirm a deposit taken as pay, and remembers the answer", async ({ page, drive }) => {
    drive.seed(account({ settings: { salaryKeywords: [] } }));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Is this your pay?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, that's my pay" }).click();
    await expect(page.getByRole("heading", { name: "Is this your pay?" })).toBeHidden();
    await expect.poll(() => drive.appFile<{ salaryKeywords: string[] }>("settings").salaryKeywords).toEqual(["salary acme ltd"]);
  });

  test("shows the guided tour once, and remembers it was seen", async ({ page, drive }) => {
    drive.seed(account({ settings: { tourPages: {} } }));
    await page.goto("/dashboard");
    const tour = page.getByRole("dialog", { name: "What you can spend" });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await page.getByRole("dialog", { name: "Your budget at a glance" }).getByRole("button", { name: "Next" }).click();
    await page.getByRole("dialog", { name: "When you spend" }).getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect.poll(() => drive.appFile<{ tourPages: Record<string, boolean> }>("settings").tourPages.dashboard).toBe(true);
  });
});
