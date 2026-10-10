import { test, expect, type Page } from "./support/fixtures";
import { account } from "./support/data";

type StoredSettings = {
  paydayOfMonth: number;
  selfTransferKeywords: string[];
  monthlyBudgets: Record<string, { income: number }>;
  recurringPayments: { name: string; amount: number; dayOfMonth: number; category: string; startMonth?: string }[];
};

/** A form field on the open tab. Every tab's form stays in the page (hidden), so labels repeat. */
const field = (page: Page, label: string | RegExp, options?: { exact?: boolean }) =>
  page.getByLabel(label, options).filter({ visible: true });

async function open(page: Page, query = "") {
  await page.goto(`/settings${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
}

test.describe("settings", () => {
  test.beforeEach(async ({ drive }) => {
    drive.seed(account());
  });

  test("basics: changing payday saves to Drive", async ({ page, drive }) => {
    await open(page);
    const payday = field(page, "Day of the month you get paid");
    await expect(payday).toHaveValue("1");
    await payday.fill("25");
    await expect(page.getByText("Each pay period starts on the 25th.")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await expect.poll(() => drive.appFile<StoredSettings>("settings").paydayOfMonth).toBe(25);
  });

  test("basics: after changing payday the dashboard still shows today's pay period", async ({ page }) => {
    await open(page);
    await field(page, "Day of the month you get paid").fill("25");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await page.getByRole("complementary").getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByText("Today · Monday 15 June")).toBeVisible();
    await expect(page.getByText("25 May – 24 Jun")).toBeVisible();
  });

  test("unsaved edits survive switching tabs", async ({ page }) => {
    await open(page);
    await field(page, "Day of the month you get paid").fill("25");
    await page.getByRole("tab", { name: "Bills" }).click();
    await expect(page.getByRole("heading", { name: "Bills" })).toBeVisible();
    await page.getByRole("tab", { name: "Basics" }).click();
    await expect(field(page, "Day of the month you get paid")).toHaveValue("25");
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("a settings save that fails says so", async ({ page }) => {
    await open(page);
    await page.route(/upload\/drive\/v3\/files\/.+uploadType=media/, (route) => route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" } }));
    await field(page, "Day of the month you get paid").fill("25");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Couldn't save to Drive. Your change was undone.")).toBeVisible();
  });

  test("basics: the budget split must add up to 100%", async ({ page }) => {
    await open(page);
    await field(page, /^Needs %/).fill("60");
    await expect(page.getByText("Adds up to 110%")).toBeVisible();
    await expect(page.getByText(". It needs to be 100%.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await field(page, /^Wants %/).fill("20");
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("basics: save stays off until something changes", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("basics: keywords for your own transfers", async ({ page, drive }) => {
    await open(page);
    const input = page.getByRole("textbox", { name: "Add to Your own transfers" });
    await input.fill("Alex Tester");
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "Remove alex tester" })).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => drive.appFile<StoredSettings>("settings").selfTransferKeywords).toEqual(["alex tester"]);
  });

  test("period: one pay period can have its own pay", async ({ page, drive }) => {
    await open(page);
    await page.getByRole("tab", { name: "Period" }).click();
    await expect(page.getByText("Using Basics")).toBeVisible();
    await field(page, /^Amount/).fill("2500");
    await page.getByRole("button", { name: "Save for June 2026" }).click();
    await expect(page.getByText("Changed", { exact: true })).toBeVisible();
    await expect.poll(() => drive.appFile<StoredSettings>("settings").monthlyBudgets["2026-06"]?.income).toBe(2500);
  });

  test("period: old links to the monthly tab still work", async ({ page }) => {
    await open(page, "?tab=monthly");
    await expect(page.getByRole("tab", { name: "Period" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "This pay period" })).toBeVisible();
  });

  test("bills: edit an existing bill", async ({ page, drive }) => {
    await open(page, "?tab=bills");
    await page.getByRole("button", { name: "Edit Rent" }).click();
    await field(page, /^Amount/).first().fill("850");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("€850.00")).toBeVisible();
    await page.getByRole("button", { name: "Save bills" }).click();
    await expect.poll(() => drive.appFile<StoredSettings>("settings").recurringPayments[0].amount).toBe(850);
  });

  test("bills: removing one needs a save", async ({ page, drive }) => {
    await open(page, "?tab=bills");
    await page.getByRole("button", { name: "Remove Rent" }).click();
    await expect(page.getByText("No bills yet")).toBeVisible();
    await page.getByRole("button", { name: "Save bills" }).click();
    await expect.poll(() => drive.appFile<StoredSettings>("settings").recurringPayments).toEqual([]);
  });

  test("rules: add, edit in place and save", async ({ page, drive }) => {
    await open(page, "?tab=rules");
    await expect(page.getByText("1 of 1 rules")).toBeVisible();

    await field(page, "Keyword (in description)").fill("Wolt");
    await field(page, "Category", { exact: true }).selectOption("Needs");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByText("2 of 2 rules")).toBeVisible();

    // Typing into a rule keeps focus — each keystroke used to remount the row.
    const keyword = page.getByRole("textbox", { name: "Shop name contains" }).first();
    await expect(keyword).toHaveValue("wolt");
    await keyword.click();
    await keyword.press("End");
    await keyword.pressSequentially(" delivery");
    await expect(keyword).toBeFocused();
    await expect(keyword).toHaveValue("wolt delivery");

    await page.getByRole("button", { name: "Save rules" }).click();
    await expect.poll(() => drive.appFile("categoryRules")).toEqual({
      v: 1,
      customized: true,
      rules: [{ keyword: "wolt delivery", category: "Needs" }, { keyword: "lidl", category: "Needs" }],
    });
  });

  test("rules: a keyword can only have one rule", async ({ page }) => {
    await open(page, "?tab=rules");
    await field(page, "Keyword (in description)").fill("lidl");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByText("There’s already a rule for this word.")).toBeVisible();
  });

  test("rules: delete several at once", async ({ page, drive }) => {
    await open(page, "?tab=rules");
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("button", { name: "Select all" }).click();
    await page.getByRole("button", { name: "Delete 1" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("0 of 0 rules")).toBeVisible();
    await page.getByRole("button", { name: "Save rules" }).click();
    await expect.poll(() => drive.appFile<{ rules: unknown[] }>("categoryRules").rules).toEqual([]);
  });

  test("links to the Monera folder in Drive", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("link", { name: "Open my Monera folder in Drive" })).toHaveAttribute(
      "href",
      /^https:\/\/drive\.google\.com\/drive\/folders\/file\d+$/
    );
  });

  test("replaying the guide shows the dashboard tour again", async ({ page, drive }) => {
    await open(page);
    await page.getByRole("button", { name: "Replay app guide" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("dialog", { name: "What you can spend" })).toBeVisible();
    expect(drive.appFile<{ tourPages: object }>("settings").tourPages).toEqual({});
  });
});

test("bills: a new bill starts in the pay period running today", async ({ page, drive }) => {
  // Payday on the 25th: on 15 June the running period is the one that started 25 May.
  drive.seed(account({ settings: { paydayOfMonth: 25 } }));
  await open(page, "?tab=bills");

  const startPicker = page.getByRole("group", { name: "From period" }).last();
  await expect(startPicker.getByRole("combobox", { name: "Month" })).toHaveValue("05");
  await expect(startPicker.getByRole("combobox", { name: "Year" })).toHaveValue("2026");

  await field(page, "Name").fill("Gym");
  await field(page, /^Amount/).fill("30");
  await field(page, "Day of month").fill("3");
  await page.getByRole("button", { name: "Add to list" }).click();
  await expect(page.getByText("3rd · Needs · From May 2026")).toBeVisible();
  await page.getByRole("button", { name: "Save bills" }).click();
  await expect.poll(() => drive.appFile<StoredSettings>("settings").recurringPayments.find((b) => b.name === "Gym")).toEqual(
    expect.objectContaining({ amount: 30, dayOfMonth: 3, startMonth: "2026-05" })
  );
});

test("signing out returns to sign-in and ends the session", async ({ page, drive }) => {
  drive.seed(account());
  await page.goto("/dashboard");
  await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
