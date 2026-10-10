import { toast } from "sonner";

/** Tells the user a change didn't reach their Drive. The app has already put things back as they were. */
export function notifySaveFailed(): void {
  toast.error("Couldn't save to Drive. Your change was undone.", { id: "save-failed" });
}
