import { Button } from "@/components/ui/button";
import type { SaveStatus } from "@/hooks/useSaveStatus";

/** The one save button every settings form ends with. */
export function SaveButton({ status, disabled, onClick, label = "Save" }: {
  status: SaveStatus;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button onClick={onClick} disabled={disabled || status === "saving"} className="w-full sm:w-auto sm:self-start sm:px-8">
      {/* A failed save is explained by the app-wide "Couldn't save" message. */}
      {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : label}
    </Button>
  );
}
