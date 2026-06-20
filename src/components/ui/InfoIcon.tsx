"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface InfoIconProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  onClick?: () => void;
}

export function InfoIcon({ content, side = "top", onClick }: InfoIconProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // Toggle on tap (mobile); hover already handled via onOpenChange
            setOpen((v) => !v);
            onClick?.();
          }}
          className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          aria-label="More info"
        >
          <Info size={14} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  );
}
