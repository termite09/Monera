"use client";

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Runs a save and tracks it for the button: saving → saved (for 2s) or error. */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = async (save: () => Promise<void>): Promise<boolean> => {
    setStatus("saving");
    clearTimeout(timer.current);
    try {
      await save();
      setStatus("saved");
      timer.current = setTimeout(() => setStatus("idle"), 2000);
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  };

  return { status, run };
}
