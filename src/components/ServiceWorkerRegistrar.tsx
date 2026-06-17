"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      // SW registration is best-effort; failures don't affect the app.
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      return;
    }

    // In development a cache-first SW serves stale /_next/static chunks and
    // breaks HMR — tear down any previously-registered worker and its caches.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);

  return null;
}
