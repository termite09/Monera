import { useSession, signIn, signOut } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    accessToken: session?.accessToken as string | undefined,
    signIn: () => signIn("google"),
    signOut: () => signOut({ callbackUrl: "/login" }),
  };
}
