import { ReactNode } from "react";

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function Select({
  label,
  value,
  onChange,
  children,
  required,
  className = "",
}: SelectProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="h-11 px-3 rounded-lg border border-gray-200 dark:border-[#2D2D2D] bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-shadow"
      >
        {children}
      </select>
    </div>
  );
}
