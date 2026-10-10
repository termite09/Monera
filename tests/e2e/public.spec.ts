import { signedOutTest as test, expect, alerts } from "./support/fixtures";

test.describe("public pages", () => {
  test("landing page introduces Monera and links to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Monera/);
    await expect(page.getByRole("heading", { level: 1, name: "Finally know where your money goes." })).toBeVisible();
    await page.getByRole("link", { name: "Get started, it's free" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("sign-in page offers Google sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Monera" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(alerts(page)).toHaveCount(0);
  });

  test("sign-in page explains an expired session", async ({ page }) => {
    await page.goto("/login?error=SessionExpired");
    await expect(alerts(page)).toHaveText("Your session expired. Please sign in again.");
  });

  test("privacy policy and terms load", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
  });

  for (const path of ["/dashboard", "/transactions", "/insights", "/upload", "/settings"]) {
    test(`${path} sends signed-out visitors to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("robots.txt keeps the app private", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBe(true);
    expect(await res.text()).toContain("Disallow");
  });

  test("pages send a strict Content-Security-Policy", async ({ request }) => {
    const res = await request.get("/privacy");
    const csp = res.headers()["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
  });
});
