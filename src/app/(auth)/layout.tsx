import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomBar } from "@/components/layout/BottomBar";
import { AppDataProvider } from "@/contexts/AppDataContext";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SessionProvider } from "next-auth/react";

export const dynamic = "force-dynamic";

// The app itself lives behind auth — keep every signed-in page out of search results.
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // An errored session (e.g. an expired/revoked refresh token) is sent to /login
  // with a reason so the sign-in screen can explain why the user was signed out.
  if (session?.error) redirect("/login?error=SessionExpired");
  if (!session?.user) redirect("/login");

  // Refetch the session every 4 minutes (and on focus) so the Drive access token
  // stays fresh — the server refreshes it before it expires.
  return (
    <SessionProvider session={session} refetchInterval={4 * 60} refetchOnWindowFocus>
      <AppDataProvider>
        <Sidebar />
        <OfflineBanner />
        {children}
        <BottomBar />
      </AppDataProvider>
    </SessionProvider>
  );
}
