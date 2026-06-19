export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomBar } from "@/components/layout/BottomBar";
import { AppDataProvider } from "@/contexts/AppDataContext";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppDataProvider>
      <Sidebar />
      {children}
      <BottomBar />
    </AppDataProvider>
  );
}
