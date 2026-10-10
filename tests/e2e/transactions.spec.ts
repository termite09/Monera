import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "./support/fixtures";
import { account, manualTransaction } from "./support/data";

const summary = (page: Page) => page.getByText(/\d+ transactions? · /);
const rowCheckboxes = (page: Page) => page.getByRole("checkbox", { name: /^Select (?!all)/ });

async function open(page: Page) {
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await expect(summary(page)).toBeVisible();
}

test.describe("transactions list", () => {
  test.beforeEach(async ({ page, drive }) => {
    drive.seed(account());
    await open(page);
  });

  test("shows this pay period's spending, with bills still to come marked", async ({ page }) => {
    // Rent (20 Jun) is listed but not counted until it happens.
    await expect(summary(page)).toHaveText("4 transactions · €187.99");
    for (const name of ["Zara", "Wolt", "Netflix", "Lidl", "Rent"]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Upcoming")).toBeVisible();
    // Declined payments and top-ups never make it in.
    await expect(page.getByText("Declined shop")).toHaveCount(0);
  });

  test("searches descriptions, with / as a shortcut", async ({ page }) => {
    await page.locator("body").press("/");
    await expect(page.getByRole("searchbox", { name: "Search transactions" })).toBeFocused();
    await page.keyboard.type("wolt");
    await expect(summary(page)).toHaveText("1 transaction · €25.00");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(summary(page)).toHaveText("4 transactions · €187.99");
  });

  test("switches between expenses, income and everything", async ({ page }) => {
    await page.getByRole("radio", { name: "Income" }).click();
    await expect(summary(page)).toHaveText("1 transaction · €2,000.00");
    await expect(page.getByText("Salary ACME Ltd")).toBeVisible();

    await page.getByRole("radio", { name: "All" }).click();
    await expect(summary(page)).toHaveText("5 transactions · €1,812.01");
  });

  test("filters by category", async ({ page }) => {
    await page.getByRole("combobox", { name: "Filter by category" }).selectOption("Needs");
    await expect(summary(page)).toHaveText("1 transaction · €50.00");
    await expect(page.getByText("Lidl", { exact: true })).toBeVisible();
    await expect(page.getByText("Zara", { exact: true })).toHaveCount(0);
  });

  test("a custom date range reaches back into earlier periods", async ({ page }) => {
    await page.getByRole("radio", { name: "Custom" }).click();
    await expect(page.getByRole("textbox", { name: "From date" })).toHaveValue("2026-06-01");
    await expect(page.getByRole("textbox", { name: "To date" })).toHaveValue("2026-06-30");
    await page.getByRole("textbox", { name: "From date" }).fill("2026-05-01");
    await expect(page.getByText("1 May – 30 Jun")).toBeVisible();
    // May adds Lidl 40, Netflix 12.99, Wolt 20 and May's rent 800.
    await expect(summary(page)).toHaveText("8 transactions · €1,060.98");
  });

  test("sorts by amount both ways", async ({ page }) => {
    await page.getByRole("button", { name: /^Sort by amount/ }).click();
    await expect(rowCheckboxes(page).first()).toHaveAccessibleName("Select Netflix, −€12.99");
    await page.getByRole("button", { name: /^Sort by amount/ }).click();
    await expect(rowCheckboxes(page).first()).toHaveAccessibleName("Select Rent, −€800.00");
  });

  test("moves one transaction to another category, with undo", async ({ page, drive }) => {
    await page.getByRole("button", { name: "Category of Wolt: Wants. Change" }).click();
    await page.getByRole("dialog", { name: "Move Wolt to…" }).getByRole("button", { name: /^Needs/ }).click();
    await expect(page.getByRole("button", { name: "Category of Wolt: Needs. Change" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Moved Wolt to Needs" })).toBeVisible();
    await expect.poll(() => Object.values(drive.appFile<Record<string, string>>("categoryOverrides"))).toEqual(["Needs"]);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Category of Wolt: Wants. Change" })).toBeVisible();
    await expect.poll(() => Object.values(drive.appFile<Record<string, string>>("categoryOverrides"))).toEqual(["Wants"]);
  });

  test("moves several ticked transactions at once", async ({ page, drive }) => {
    await page.getByRole("checkbox", { name: "Select Wolt, −€25.00" }).click();
    await page.getByRole("checkbox", { name: "Select Zara, −€100.00" }).click();
    const bar = page.getByRole("region", { name: "Selected transactions" });
    await expect(bar.getByText("2 selected")).toBeVisible();
    await bar.getByRole("button", { name: "Move to…" }).click();
    await page.getByRole("dialog", { name: "Move 2 to…" }).getByRole("button", { name: /^Needs/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Moved 2 to Needs" })).toBeVisible();
    await expect.poll(() => Object.keys(drive.appFile("categoryOverrides") as object).length).toBe(2);
  });

  test("shift-click ticks a run of rows", async ({ page }) => {
    await page.getByRole("checkbox", { name: "Select Zara, −€100.00" }).click();
    await page.getByRole("checkbox", { name: "Select Lidl, −€50.00" }).click({ modifiers: ["Shift"] });
    // Zara, Wolt, Netflix, Lidl (newest first).
    await expect(page.getByRole("region", { name: "Selected transactions" }).getByText("4 selected")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Selected transactions" })).toBeHidden();
  });

  test("leaving a transaction out removes it from the total, and undo counts it again", async ({ page, drive }) => {
    await page.getByRole("checkbox", { name: "Select Zara, −€100.00" }).click();
    await page.getByRole("region", { name: "Selected transactions" }).getByRole("button", { name: "Leave out" }).click();
    await expect(summary(page)).toHaveText("4 transactions · €87.99");
    await expect.poll(() => drive.appFile<string[]>("excludedTransactions").length).toBe(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(summary(page)).toHaveText("4 transactions · €187.99");
    await expect.poll(() => drive.appFile<string[]>("excludedTransactions").length).toBe(0);
  });

  test("reset puts a changed transaction back how the statement had it", async ({ page, drive }) => {
    await page.getByRole("button", { name: "Category of Zara: Wants. Change" }).click();
    await page.getByRole("dialog", { name: "Move Zara to…" }).getByRole("button", { name: /^Savings/ }).click();
    await expect(page.getByText("Zara", { exact: true })).toBeHidden(); // Savings sit on their own list

    await page.getByRole("radio", { name: "Savings" }).click();
    await page.getByRole("checkbox", { name: "Select Zara, −€100.00" }).click();
    await page.getByRole("region", { name: "Selected transactions" }).getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => Object.keys(drive.appFile("categoryOverrides") as object).length).toBe(0);
    await expect(page.getByText("Zara", { exact: true })).toBeHidden();
  });

  test("adds a transaction dated today", async ({ page, drive }) => {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog.getByLabel("Date")).toHaveValue("2026-06-15");
    await dialog.getByLabel("Description").fill("Coffee");
    await dialog.getByLabel(/^Amount/).fill("3.50");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText("Coffee", { exact: true })).toBeVisible();
    await expect(summary(page)).toHaveText("5 transactions · €191.49");
    await expect.poll(() => drive.appFile<{ description: string }[]>("manualTransactions")).toEqual([
      expect.objectContaining({ description: "Coffee", amount: 3.5, date: "2026-06-15", currency: "EUR", category: "Wants" }),
    ]);
  });

  test("checks the form before adding", async ({ page }) => {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog.getByText("Description is required")).toBeVisible();
    await expect(dialog.getByText("Amount is required")).toBeVisible();
    await dialog.getByLabel(/^Amount/).fill("-5");
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(dialog.getByText("Enter a valid amount greater than 0")).toBeVisible();
  });

  test("tells you when a new transaction couldn't be saved", async ({ page, drive }) => {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await dialog.getByLabel("Description").fill("Coffee");
    await dialog.getByLabel(/^Amount/).fill("3.50");
    await page.route(/upload\/drive\/v3\/files\/.+uploadType=media/, (route) => route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" } }));
    await dialog.getByRole("button", { name: "Add transaction" }).click();
    await expect(page.getByText("Couldn't save to Drive. Your change was undone.")).toBeVisible();
    // The form stays open with what was typed, so it can be tried again.
    await expect(dialog.getByLabel("Description")).toHaveValue("Coffee");
    expect(drive.appFile<unknown[]>("manualTransactions")).toEqual([]);
  });

  test("a category change that can't be saved says so and changes back", async ({ page }) => {
    await page.route(/upload\/drive\/v3\/files\/.+uploadType=media/, (route) => route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" } }));
    await page.getByRole("button", { name: "Category of Wolt: Wants. Change" }).click();
    await page.getByRole("dialog", { name: "Move Wolt to…" }).getByRole("button", { name: /^Needs/ }).click();
    await expect(page.getByText("Couldn't save to Drive. Your change was undone.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Category of Wolt: Wants. Change" })).toBeVisible();
  });
});

test.describe("your own transactions", () => {
  test.beforeEach(async ({ page, drive }) => {
    drive.seed(account({
      manualTransactions: [manualTransaction({ id: "barber", date: "2026-06-08", description: "Barber", amount: 15, category: "Needs" })],
    }));
    await open(page);
  });

  test("can be edited", async ({ page, drive }) => {
    await expect(page.getByText("Added by you")).toBeVisible();
    await page.getByRole("button", { name: "Edit Barber" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit transaction" });
    await expect(dialog.getByLabel("Description")).toHaveValue("Barber");
    await dialog.getByLabel(/^Amount/).fill("20");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("checkbox", { name: "Select Barber, −€20.00" })).toBeVisible();
    await expect.poll(() => drive.appFile<{ amount: number }[]>("manualTransactions")[0].amount).toBe(20);
  });

  test("can be deleted, and the delete undone", async ({ page, drive }) => {
    await page.getByRole("button", { name: "Delete Barber", exact: true }).click();
    await page.getByRole("button", { name: "Delete Barber for good" }).click();
    await expect(page.getByText("Barber", { exact: true })).toBeHidden();
    await expect.poll(() => drive.appFile<unknown[]>("manualTransactions").length).toBe(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Barber", { exact: true })).toBeVisible();
    await expect.poll(() => drive.appFile<unknown[]>("manualTransactions").length).toBe(1);
  });
});

test.describe("export", () => {
  test("downloads what's on screen as a CSV that's safe to open in Excel", async ({ page, drive }) => {
    drive.seed(account({
      manualTransactions: [manualTransaction({ id: "f", date: "2026-06-09", description: "=SUM(A1:A9)", amount: 5, category: "Wants" })],
    }));
    await open(page);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("monera-transactions-2026-06.csv");

    const lines = (await readFile((await file.path())!, "utf8")).split("\n");
    expect(lines[0]).toBe("Date,Description,Category,Amount,Notes,Left out");
    expect(lines).toContain("2026-06-12,Zara,Wants,-100.00,,");
    expect(lines).toContain("2026-06-09,'=SUM(A1:A9),Wants,-5.00,,");
    // Rent hasn't happened yet, so it isn't exported.
    expect(lines.some((l) => l.includes("Rent"))).toBe(false);
  });
});
