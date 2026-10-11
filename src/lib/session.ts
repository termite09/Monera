import { signOut } from "next-auth/react";

/**
 * Signs out and forgets what this browser kept, so the next person starts clean:
 * this tab's saved filters and the offline cache (app files only now, but older
 * versions also kept signed-in pages).
 */
export async function signOutAndClear(): Promise<void> {
  try { sessionStorage.clear(); } catch { /* storage blocked — nothing to clear */ }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { /* no cache storage — nothing to clear */ }
  signOut({ redirectTo: "/login" });
}
