import { signOut } from "next-auth/react";

/** Signs out and forgets this tab's saved filters, so the next person starts clean. */
export function signOutAndClear(): void {
  try { sessionStorage.clear(); } catch { /* storage blocked — nothing to clear */ }
  signOut({ redirectTo: "/login" });
}
