import { useSession, signIn, signOut } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated" && !session?.error,
    accessToken: session?.error ? undefined : session?.accessToken,
    signIn: () => signIn("google"),
    signOut: () => signOut({ redirectTo: "/login" }),
  };
}
