import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const paddings = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-200 dark:border-[#2D2D2D]
        ${paddings[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
