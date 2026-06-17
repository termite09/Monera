"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";

interface FABProps {
  onClick: () => void;
  label?: string;
}

export function FAB({ onClick, label = "Add" }: FABProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      transition={{ duration: 0.1 }}
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 z-40 md:hidden flex items-center justify-center w-14 h-14 rounded-full bg-[#1E3A5F] text-white shadow-lg shadow-[#1E3A5F]/30 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:ring-offset-2"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <Plus size={24} strokeWidth={2} />
    </motion.button>
  );
}
