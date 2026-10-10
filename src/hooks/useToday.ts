"use client";

import { useEffect, useState } from "react";
import { toDateStr } from "@/lib/utils";

/**
 * Today's date as "YYYY-MM-DD", rolling over at midnight and whenever the app
 * comes back into view — so an installed app left open overnight shows today.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toDateStr(new Date()));

  useEffect(() => {
    const refresh = () => setToday(toDateStr(new Date()));
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(refresh, msToMidnight + 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [today]);

  return today;
}
