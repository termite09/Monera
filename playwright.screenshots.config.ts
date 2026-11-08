import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** The landing-page screenshots: same app and fake Drive as the e2e tests, run on request only. */
export default defineConfig({
  ...base,
  testDir: "./tests/screenshots",
  retries: 0,
  reporter: [["list"]],
  projects: [{ name: "screenshots", use: { ...devices["Desktop Chrome"] } }],
});
