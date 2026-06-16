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
        min-h-screen bg-[#FAFAFA] dark:bg-[#0F0F0F]
        pb-20 md:pb-6 md:ml-60
        ${className}
      `}
    >
      {children}
    </motion.main>
  );
}
