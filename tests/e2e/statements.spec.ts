import * as XLSX from "xlsx";
import { test, expect, alerts, type Page } from "./support/fixtures";
import { account, revolutCsv, STATEMENT_CSV } from "./support/data";

const NEW_STATEMENT = revolutCsv([
  ["Card Payment", "2026-06-14", "Cafe Nero", -4.5],
  ["Card Payment", "2026-06-15", "Bakery", -3],
]);

const csvFile = (name: string, csv: string) => ({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });
const chooseFile = (page: Page, file: Parameters<Page["setInputFiles"]>[1]) =>
  page.locator('input[type="file"]').setInputFiles(file);

test.describe("statements", () => {
  test.beforeEach(async ({ page, drive }) => {
    drive.seed(account());
    await page.goto("/upload");
    await expect(page.getByText("revolut-2026-06.csv")).toBeVisible();
  });

  test("previews a statement, then adds it to Drive and the dashboard", async ({ page, drive }) => {
    await chooseFile(page, csvFile("june-extra.csv", NEW_STATEMENT));
    await expect(page.getByText("Found 2 transactions from 14 Jun to 15 Jun")).toBeVisible();
    expect(drive.statements()).toHaveLength(1); // nothing saved before confirming

    await page.getByRole("button", { name: "Add to Monera" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 2 transactions." })).toBeVisible();
    await expect(page.getByText("june-extra.csv")).toBeVisible();
    expect(drive.statements().map((s) => s.name)).toContain("june-extra.csv");

    // The nudge to add bills from other accounts.
    await expect(page.getByRole("link", { name: "Add bills" })).toHaveAttribute("href", "/settings?tab=bills");

    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page.getByText("Cafe Nero")).toBeVisible();
  });

  test("cancelling the preview saves nothing", async ({ page, drive }) => {
    await chooseFile(page, csvFile("june-extra.csv", NEW_STATEMENT));
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/^Found /)).toBeHidden();
    expect(drive.statements()).toHaveLength(1);
  });

  test("converts an Excel statement to CSV", async ({ page, drive }) => {
    const rows = NEW_STATEMENT.split("\n").map((line) => line.split(","));
    const sheet = XLSX.utils.aoa_to_sheet(rows.map((r, i) => (i === 0 ? r : r.map((v, j) => (j === 5 ? Number(v) : v)))));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Statement");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await chooseFile(page, { name: "statement.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
    await expect(page.getByText("Found 2 transactions")).toBeVisible();
    await expect(page.getByText("statement.csv")).toBeVisible();
    await page.getByRole("button", { name: "Add to Monera" }).click();
    await expect.poll(() => drive.statements().map((s) => s.name)).toContain("statement.csv");
  });

  test("explains a file with no transactions in it", async ({ page }) => {
    await chooseFile(page, csvFile("notes.csv", "hello\nworld"));
    await expect(alerts(page)).toHaveText("We couldn't find any transactions in this file. Is it a statement export from your bank?");
  });

  test("turns away files that are far too big", async ({ page }) => {
    await chooseFile(page, { name: "huge.csv", mimeType: "text/csv", buffer: Buffer.alloc(26 * 1024 * 1024, "a") });
    await expect(alerts(page)).toContainText("This file is 26.0 MB. The limit is 25 MB");
  });

  test("adding the same statement twice doesn't count anything twice", async ({ page }) => {
    await chooseFile(page, csvFile("copy-of-june.csv", STATEMENT_CSV));
    await page.getByRole("button", { name: "Add to Monera" }).click();
    await expect(page.getByText("copy-of-june.csv")).toBeVisible();

    await page.getByRole("link", { name: "Transactions" }).click();
    await expect(page.getByText(/\d+ transactions? · /)).toHaveText("4 transactions · €187.99");
  });

  test("removes a statement after confirming", async ({ page, drive }) => {
    await page.getByRole("button", { name: "Remove revolut-2026-06.csv" }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("No statements added yet")).toBeVisible();
    expect(drive.statements()).toHaveLength(0);
  });

  test("explains how to export from Revolut", async ({ page }) => {
    await page.getByText("How do I export from Revolut?").click();
    await expect(page.getByText("Choose Excel or CSV as the format.")).toBeVisible();
  });
});
