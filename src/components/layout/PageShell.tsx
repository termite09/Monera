"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`
        min-h-[100dvh] w-full max-w-full overflow-x-clip bg-[#FAFAFA] dark:bg-[#0F0F0F]
        pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 md:ml-56
        ${className}
      `}
    >
      {children}
    </motion.main>
  );
}
