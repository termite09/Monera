import { test, expect } from "./support/fixtures";
import { account } from "./support/data";
import { TEST_USER } from "./support/session";

test.describe("on a phone", () => {
  test.beforeEach(async ({ page, drive }) => {
    drive.seed(account());
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Safe to spend: €612.01. Show details" })).toBeVisible();
  });

  test("the bottom bar moves between sections", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("complementary")).toBeHidden();

    await nav.getByRole("link", { name: "Transactions" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Transactions" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Insights" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  });

  test("adding a transaction opens as a bottom sheet", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Transactions" }).click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add transaction" });
    await expect(sheet).toBeVisible();
    // Anchored to the bottom edge once it has slid in.
    const bottomEdge = async () => {
      const box = await sheet.boundingBox();
      return box ? Math.round(box.y + box.height) : null;
    };
    await expect.poll(bottomEdge).toBe(page.viewportSize()!.height);
  });

  test("settings shows the account and a sign-out button", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
    await expect(page.getByText(TEST_USER.name)).toBeVisible();
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("ticking a transaction shows the action bar", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Transactions" }).click();
    await page.getByRole("checkbox", { name: "Select Zara, −€100.00" }).click();
    await expect(page.getByRole("region", { name: "Selected transactions" })).toBeInViewport();
  });
});
