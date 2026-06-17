"use client";

import { motion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  "Connecting to Google Drive",
  "Creating your Monera vault",
  "Preparing your data files",
];

interface SetupScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

export function SetupScreen({ error, onRetry }: SetupScreenProps) {
  return (
    <main
      className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#0F0F0F] px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm flex flex-col items-center text-center"
      >
        <h1 className="text-4xl text-foreground font-serif">
          Monera
        </h1>

        {error ? (
          <>
            <div className="mt-8 flex flex-col items-center gap-3">
              <span className="flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle size={24} />
              </span>
              <p className="text-sm font-medium text-foreground">Setup didn&apos;t finish</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                We couldn&apos;t set up your Google Drive folder. This is usually temporary — please try again.
              </p>
            </div>
            {onRetry && (
              <Button onClick={onRetry} className="mt-6 w-full">
                Try again
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mt-2">Setting up your private vault…</p>

            <div className="mt-8 w-full flex flex-col gap-3">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.35, duration: 0.3 }}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-left"
                >
                  <StepIcon index={i} />
                  <span className="text-sm text-foreground">{step}</span>
                </motion.div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground/70 mt-6">
              Your data stays in your own Google Drive. This only happens once.
            </p>
          </>
        )}
      </motion.div>
    </main>
  );
}

function StepIcon({ index }: { index: number }) {
  return (
    <span className="relative flex items-center justify-center size-6 shrink-0">
      <motion.span
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4 + index * 0.35, duration: 0.3 }}
        className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400"
      >
        <Check size={16} strokeWidth={3} />
      </motion.span>
      <motion.span
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 0.4 + index * 0.35, duration: 0.2 }}
        className="absolute inset-0 flex items-center justify-center text-muted-foreground"
      >
        <Loader2 size={16} className="animate-spin" />
      </motion.span>
    </span>
  );
}
