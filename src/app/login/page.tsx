import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "./LoginCard";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  // If the user is already signed in (e.g. they land here after the OAuth
  // callback, or revisit the URL), send them straight to the app instead of
  // showing the sign-in button again.
  //
  // Only skip the sign-in screen for a *healthy* session. A session that exists
  // but carries an error (e.g. an expired/revoked refresh token) must stay here
  // so the user can re-authenticate — the auth layout redirects such sessions
  // back to /login, so redirecting them to /dashboard would loop forever
  // ("cannot follow more than 20 redirections").
  const session = await auth();
  if (session && !session.error) redirect("/dashboard");

  // NextAuth (and our auth layout) pass a sign-in failure reason as ?error=.
  const { error } = await searchParams;
  return <LoginCard error={Array.isArray(error) ? error[0] : error} />;
}
