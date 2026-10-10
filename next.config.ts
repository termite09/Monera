import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Dev-only allowance so impeccable live mode can load.
const impeccableLiveOrigin = isDev ? " http://localhost:8400" : "";
// Only the dev server (React Refresh) needs eval; production never does.
const devEval = isDev ? " 'unsafe-eval'" : "";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${devEval}${impeccableLiveOrigin}`,
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
            "img-src 'self' data: https:",
            `connect-src 'self' https://googleapis.com https://*.googleapis.com https://accounts.google.com${impeccableLiveOrigin}`,
            "frame-src https://accounts.google.com",
          ].join("; "),
        },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
