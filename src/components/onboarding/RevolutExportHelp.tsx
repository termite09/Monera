import { ChevronRight } from "lucide-react";

const STEPS = [
  "Open the Revolut app and go to the account you want.",
  "Tap the account, then open Statement.",
  "Choose Excel or CSV as the format.",
  "Pick the date range you want to import.",
  "Generate the statement and save or share the file to this device.",
  "Come back here and upload it.",
];

/**
 * Plain-language guide for exporting a statement, shown wherever we ask the user
 * to upload one. Uses a native <details> disclosure so it's keyboard-accessible
 * and needs no client state.
 */
export function RevolutExportHelp() {
  return (
    <details className="group mt-2 text-xs text-muted-foreground">
      <summary className="flex items-center gap-1 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden font-medium text-primary hover:underline focus-visible:outline-none focus-visible:underline">
        <ChevronRight size={13} className="transition-transform group-open:rotate-90" />
        How do I export from Revolut?
      </summary>
      <ol className="mt-2 ml-1 flex flex-col gap-1.5 list-decimal list-inside marker:text-muted-foreground/60">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-muted-foreground/80">
        Not on Revolut? Most banks work too — export a CSV or Excel file with date, description, and amount columns.
      </p>
    </details>
  );
}
