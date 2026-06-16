import { useSession, signIn, signOut } from "next-auth/react";

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    session,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    accessToken: session?.accessToken,
    signIn: () => signIn("google"),
    signOut: () => signOut({ redirectTo: "/login" }),
  };
}
