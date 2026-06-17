import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    // Lock the app to specific Google accounts. Set ALLOWED_EMAILS (comma-separated)
    // in the environment. If unset, anyone can sign in — always set it in production.
    async signIn({ user }) {
      const allowed = (process.env.ALLOWED_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (allowed.length === 0) return true;
      const email = user.email?.toLowerCase();
      return !!email && allowed.includes(email);
    },
    async jwt({ token, account }) {
      // Initial sign-in: persist the tokens from Google
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // seconds since epoch
        return token;
      }

      // Token still valid (refresh 1 min before expiry) — reuse it
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt * 1000 - 60_000) {
        return token;
      }

      // Access token expired — refresh it using the refresh token
      const refreshToken = token.refreshToken as string | undefined;
      if (!refreshToken) {
        token.error = "RefreshAccessTokenError";
        return token;
      }

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });
        const refreshed = await res.json();
        if (!res.ok) throw refreshed;

        token.accessToken = refreshed.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
        delete token.error;
      } catch {
        token.error = "RefreshAccessTokenError";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
