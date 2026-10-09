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

const ONBOARDED_SESSION_KEY = "monera-onboarded-this-session";

/**
 * Called when the setup wizard finishes. Tours then hold off for the rest of this
 * browser session, so the user's first look at their numbers isn't covered by a
 * sheet; they appear on the next visit instead.
 */
export function markOnboardedThisSession() {
  try { sessionStorage.setItem(ONBOARDED_SESSION_KEY, "1"); } catch { /* storage blocked — tours just show */ }
}

function onboardedThisSession(): boolean {
  try { return sessionStorage.getItem(ONBOARDED_SESSION_KEY) === "1"; } catch { return false; }
}

export function AppTour({ pageKey, slides }: AppTourProps) {
  const { settings, updateSettings } = useAppData();
  const [slide, setSlide] = useState(0);
  const [open, setOpen] = useState(true);
  const [deferred] = useState(onboardedThisSession);

  // Don't show if: not onboarded yet (first-run wizard handles that), just
  // onboarded this session, or already seen.
  if (!settings.onboarded || deferred || settings.tourPages?.[pageKey]) return null;

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
          {slide > 0 && (
            <Button variant="ghost" onClick={() => setSlide((s) => s - 1)}>
              Back
            </Button>
          )}
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
