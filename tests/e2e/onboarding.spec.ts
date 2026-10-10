import { test, expect } from "./support/fixtures";
import { STATEMENT_CSV } from "./support/data";

type StoredSettings = {
  onboarded: boolean;
  paydayOfMonth: number;
  defaultIncome: number;
  defaultBudgetRule: { needs: number; wants: number; savings: number };
};

test.describe("first run", () => {
  test.beforeEach(async ({ page }) => {
    // An empty Drive: the app creates its folder, then asks the setup questions.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "When do you get paid?" })).toBeVisible();
  });

  test("creates the Monera folder in the user's Drive", async ({ drive }) => {
    expect(drive.folders().sort()).toEqual(["Monera", "app-data", "revolut-exports"]);
    expect(drive.appFile<StoredSettings>("settings").onboarded).toBe(false);
  });

  test("hides the navigation until setup is done", async ({ page }) => {
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  });

  test("walks through payday, pay, split and a first statement", async ({ page, drive }) => {
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    const next = page.getByRole("button", { name: "Continue" });
    await expect(next).toBeDisabled();
    await page.getByLabel("Day of the month").fill("40");
    await expect(page.getByText("Enter a day between 1 and 31.")).toBeVisible();
    await page.getByLabel("Day of the month").fill("25");
    await expect(page.getByText("Your pay periods will start on the 25th.")).toBeVisible();
    await next.click();

    await expect(page.getByRole("heading", { name: "How much do you get paid?" })).toBeVisible();
    await page.getByLabel("Pay per period").fill("2400");
    await next.click();

    await expect(page.getByRole("heading", { name: "How would you like to split your pay?" })).toBeVisible();
    await expect(page.getByText("Adds up to 100% of your €2,400.00 pay")).toBeVisible();
    await expect(page.getByText("€1,200.00")).toBeVisible(); // 50% Needs
    await page.getByLabel("Wants").fill("40");
    await expect(page.getByText("Adds up to 110%. It needs to be 100%.")).toBeVisible();
    await expect(next).toBeDisabled();
    await page.getByLabel("Wants").fill("30");
    await next.click();

    await expect(page.getByRole("heading", { name: "Add your first statement" })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: "revolut.csv", mimeType: "text/csv", buffer: Buffer.from(STATEMENT_CSV) });
    await expect(page.getByText("Added 12 transactions.")).toBeVisible();
    await page.getByRole("button", { name: "Go to my dashboard" }).click();

    await expect(page.getByRole("button", { name: /^Safe to spend: / })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    // Tours wait for the next visit, so the first look isn't covered.
    await expect(page.getByRole("dialog")).toBeHidden();

    const settings = drive.appFile<StoredSettings>("settings");
    expect(settings).toMatchObject({
      onboarded: true,
      paydayOfMonth: 25,
      defaultIncome: 2400,
      defaultBudgetRule: { needs: 50, wants: 30, savings: 20 },
    });
    expect(drive.statements().map((s) => s.name)).toEqual(["revolut.csv"]);
  });

  test("a first statement from an earlier month shows that month, not an empty dashboard", async ({ page }) => {
    await page.getByLabel("Day of the month").fill("1");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue" }).click();
    const mayOnly = STATEMENT_CSV.split("\n").filter((line) => !line.includes("2026-06")).join("\n");
    await page.locator('input[type="file"]').setInputFiles({ name: "may.csv", mimeType: "text/csv", buffer: Buffer.from(mayOnly) });
    await page.getByRole("button", { name: "Go to my dashboard" }).click();
    await expect(page.getByText("Past pay period · ended Sunday 31 May")).toBeVisible();
  });

  test("can go back a step", async ({ page }) => {
    await page.getByLabel("Day of the month").fill("10");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Day of the month")).toHaveValue("10");
  });

  test("can skip the statement and add one later", async ({ page }) => {
    await page.getByLabel("Day of the month").fill("1");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("No statement yet? You can add one later from Statements.")).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("heading", { name: "No transactions yet" })).toBeVisible();
  });
});
