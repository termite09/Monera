/** Settings shared by the Playwright config and the tests. */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

/** Signs the test session cookie. Only ever used against the local test server. */
export const E2E_AUTH_SECRET = "monera-e2e-secret-for-local-test-servers-only";

/** Every test runs at this moment, in this timezone, so the figures are predictable. */
export const E2E_NOW = "2026-06-15T10:00:00+03:00"; // Monday 15 June 2026
export const E2E_TIMEZONE = "Europe/Nicosia";
