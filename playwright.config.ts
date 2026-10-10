import { defineConfig, devices } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_BASE_URL, E2E_PORT, E2E_TIMEZONE } from "./tests/e2e/support/env";

/**
 * End-to-end tests run against a production build. Google sign-in is replaced
 * by a session cookie signed with a test secret, and Google Drive by an
 * in-memory fake (tests/e2e/support/fakeDrive.ts), so no real account is used.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: E2E_TIMEZONE,
    locale: "en-GB",
    // The service worker would cache pages between tests.
    serviceWorkers: "block",
    // Counting-up figures settle instantly, so tests read final values.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Real environment variables win over .env.local, so the server uses the test secret.
    env: {
      AUTH_SECRET: E2E_AUTH_SECRET,
      NEXTAUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_URL: E2E_BASE_URL,
      NEXTAUTH_URL: E2E_BASE_URL,
      AUTH_TRUST_HOST: "true",
      GOOGLE_CLIENT_ID: "e2e-client-id",
      GOOGLE_CLIENT_SECRET: "e2e-client-secret",
    },
  },
});
