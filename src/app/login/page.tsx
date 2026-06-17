import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginCard } from "./LoginCard";

export default async function LoginPage() {
  // If the user is already signed in (e.g. they land here after the OAuth
  // callback, or revisit the URL), send them straight to the app instead of
  // showing the sign-in button again.
  const session = await auth();
  if (session) redirect("/dashboard");

  return <LoginCard />;
}
