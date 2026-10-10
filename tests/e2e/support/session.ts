import { encode } from "next-auth/jwt";
import type { BrowserContext } from "@playwright/test";
import { E2E_AUTH_SECRET } from "./env";

// Over plain http Auth.js uses the unprefixed cookie name, which is also the salt.
const COOKIE_NAME = "authjs.session-token";

export const TEST_USER = { name: "Alex Tester", email: "alex@example.com" };

/** Signs the browser in as the test user, with a Drive token that won't need refreshing. */
export async function signIn(context: BrowserContext): Promise<void> {
  const token = await encode({
    salt: COOKIE_NAME,
    secret: E2E_AUTH_SECRET,
    token: {
      ...TEST_USER,
      sub: "e2e-user",
      accessToken: "e2e-access-token",
      refreshToken: "e2e-refresh-token",
      expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
  });
  await context.addCookies([
    { name: COOKIE_NAME, value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
}
