"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = "" }: PageShellProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`
        min-h-[100dvh] max-w-full overflow-x-clip bg-background
        pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 md:ml-56
        ${className}
      `}
    >
      {children}
    </motion.main>
  );
}
