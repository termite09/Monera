import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display, DM_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Google reads up to ~155 chars in SERPs — use the full version.
const META_DESCRIPTION =
  "Turn your Revolut export into payday-aware budgets and spending insights — stored privately in your own Google Drive. Free, open-source, no bank login.";

// Social previews (Twitter, LinkedIn, WhatsApp) truncate around 125 chars on mobile.
const OG_DESCRIPTION =
  "Turn your Revolut export into payday-aware budgets — stored in your own Google Drive. Free, open-source, no bank login.";

export const metadata: Metadata = {
  metadataBase: new URL("https://mymonera.com"),
  title: {
    default: "Monera — Private Budgeting for Revolut Users",
    template: "%s · Monera",
  },
  description: META_DESCRIPTION,
  applicationName: "Monera",
  alternates: { canonical: "/" },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Monera",
  },
  openGraph: {
    type: "website",
    siteName: "Monera",
    title: "Monera — Private Budgeting for Revolut Users",
    description: OG_DESCRIPTION,
    url: "https://mymonera.com",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Monera — Private Budgeting for Revolut Users",
    description: OG_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#1E3A5F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmSerifDisplay.variable} ${dmMono.variable}`}
    >
      <body>
        <Providers session={session}>
          {children}
        </Providers>
        <ServiceWorkerRegistrar />
        <Analytics />
      </body>
    </html>
  );
}
