"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** A quiet notice while the device is offline: the numbers shown are the last ones loaded. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 lg:ml-28 px-4">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
        <WifiOff size={14} aria-hidden />
        You&apos;re offline. Showing what was last loaded.
      </div>
    </div>
  );
}
