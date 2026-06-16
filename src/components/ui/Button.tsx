"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  fullWidth?: boolean;
}

const variants = {
  primary: "bg-[#1E3A5F] text-white hover:bg-[#162d4a] border-transparent",
  secondary: "bg-transparent text-[#1E3A5F] border-[#1E3A5F] hover:bg-[#1E3A5F]/5 dark:text-blue-400 dark:border-blue-400",
  destructive: "bg-transparent text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
  ghost: "bg-transparent text-gray-600 border-transparent hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm min-h-[36px]",
  md: "px-4 py-2.5 text-sm min-h-[44px]",
  lg: "px-6 py-3 text-base min-h-[52px]",
};

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  className = "",
  fullWidth = false,
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg border
        transition-colors duration-150 select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {children}
    </motion.button>
  );
}
