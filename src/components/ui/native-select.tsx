import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The app's dropdown: a styled native <select>, so phones get their own picker
 * and it works with the keyboard and screen readers out of the box.
 */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
