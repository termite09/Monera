"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";

export interface TourSlide {
  title: string;
  body: string;
}

interface AppTourProps {
  pageKey: string;
  slides: TourSlide[];
}

export function AppTour({ pageKey, slides }: AppTourProps) {
  const { settings, updateSettings } = useAppData();
  const [slide, setSlide] = useState(0);
  const [open, setOpen] = useState(true);

  // Don't show if: not onboarded yet (first-run wizard handles that), or already seen
  if (!settings.onboarded || settings.tourPages?.[pageKey]) return null;

  const isLast = slide === slides.length - 1;

  const dismiss = () => {
    setOpen(false);
    // Save in background — sheet closes instantly, write happens behind the scenes
    updateSettings({
      ...settings,
      tourPages: { ...(settings.tourPages ?? {}), [pageKey]: true },
    });
  };

  const current = slides[slide];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[60vh] flex flex-col">
        <SheetHeader className="text-left pb-2">
          <div className="flex items-center gap-2 mb-1">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${i === slide ? "w-6 bg-primary" : "w-2 bg-border"}`}
              />
            ))}
          </div>
          <SheetTitle className="text-lg font-semibold">{current.title}</SheetTitle>
        </SheetHeader>

        <p className="text-sm text-muted-foreground leading-relaxed flex-1">{current.body}</p>

        <div className="flex gap-3 pt-4">
          <Button variant="ghost" className="text-muted-foreground" onClick={dismiss}>
            Skip tour
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              if (isLast) {
                dismiss();
              } else {
                setSlide((s) => s + 1);
              }
            }}
          >
            {isLast ? "Got it" : "Next"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
