"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Loader2, X } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { listFiles, uploadCSV, deleteFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { readSpreadsheetAsCsv, csvFileName } from "@/lib/spreadsheet";
import { DriveAuthError } from "@/lib/errors";
import { formatDate, formatShortDate, cn } from "@/lib/utils";
import { RevolutExportHelp } from "@/components/onboarding/RevolutExportHelp";

interface UploadedFile {
  id: string;
  name: string;
  createdTime: string;
}

/** A parsed file waiting for the user to confirm before it's written to Drive. */
interface PendingImport {
  name: string;
  content: string;
  count: number;
  skipped: number;
  from: string | null;
  to: string | null;
}

/** Plain-language error for anything that goes wrong reading or saving a file. */
function friendlyUploadError(err: unknown): string {
  if (err instanceof DriveAuthError) return "Your Google sign-in has expired. Sign out and back in, then try again.";
  const detail = err instanceof Error ? err.message : "";
  if (/network|fetch|failed to fetch/i.test(detail)) return "Couldn't reach Google Drive. Check your connection and try again.";
  return "We couldn't add this file. Check it's a CSV or Excel export from your bank and try again.";
}

export default function UploadPage() {
  
  const router = useRouter();
  const { structure, settings, updateSettings, refetch } = useAppData();
  const { accessToken } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    if (!accessToken || !structure) return;
    const files = await listFiles(
      accessToken,
      `'${structure.revolutExportsId}' in parents and mimeType='text/csv' and trashed=false`
    );
    setExistingFiles(files.map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime })));
  }, [accessToken, structure]);

  // Fetch the uploaded-file list on mount / when the loader identity changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadFiles(); }, [loadFiles]);

  // Step 1: read and check the file locally. Nothing is written to Drive yet.
  const handleFile = useCallback(async (file: File) => {
    if (!accessToken || !structure) return;

    const MAX_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setStatus("error");
      setMessage(`This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB — try exporting a shorter date range.`);
      return;
    }

    setPending(null);
    setStatus("uploading");
    setMessage("Reading your file…");

    try {
      // Excel files are converted to CSV and stored as .csv so everything
      // downstream (parsing, dedup, cache) stays CSV-only.
      const content = await readSpreadsheetAsCsv(file);
      const { transactions, errors } = parseCSV(content);
      if (transactions.length === 0) {
        setStatus("error");
        setMessage("We couldn't find any transactions in this file. Is it a statement export from Revolut?");
        return;
      }
      const dates = transactions.map((t) => t.date).sort();
      setPending({
        name: csvFileName(file.name),
        content,
        count: transactions.length,
        skipped: errors.length,
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
      });
      setStatus("idle");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setMessage(friendlyUploadError(err));
    }
  }, [accessToken, structure]);

  // Step 2: the user confirmed — save the file to their Drive folder.
  const confirmImport = useCallback(async () => {
    if (!accessToken || !structure || !pending) return;
    const { name, content, count } = pending;
    setPending(null);
    setStatus("uploading");
    setMessage("Adding to your Monera folder…");
    try {
      await uploadCSV(accessToken, name, structure.revolutExportsId, content);
      setStatus("success");
      setMessage(`Added ${count} transaction${count === 1 ? "" : "s"}. Your dashboard is up to date.`);
      await loadFiles();
      refetch();
    } catch (err) {
      setStatus("error");
      setMessage(friendlyUploadError(err));
    }
  }, [accessToken, structure, pending, loadFiles, refetch]);

  const handleDelete = useCallback(async (fileId: string) => {
    if (!accessToken) return;
    setDeletingId(fileId);
    try {
      await deleteFile(accessToken, fileId);
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
      refetch();
    } catch (err) {
      if (err instanceof DriveAuthError) throw err; // let AppDataContext handle reauth
      setStatus("error");
      setMessage("Couldn't remove that file. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }, [accessToken, refetch]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <PageShell>
      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-6 md:max-w-none md:px-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Add a statement</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[65ch]">
            Export your statement from Revolut and add it here — once per pay period is enough. Other banks&apos; CSV files usually work too if they have date, description and amount columns.
          </p>
        </div>

        {/* Drop zone — a real button, so it works from the keyboard too */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <button
          type="button"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          disabled={status === "uploading"}
          className={cn(
            "w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors disabled:cursor-wait",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary hover:bg-secondary"
          )}
        >
          <Upload size={32} className="mx-auto mb-3 text-muted-foreground" aria-hidden />
          <span className="block text-sm font-medium text-foreground">Choose a file, or drop it here</span>
          <span className="block text-xs text-muted-foreground mt-1">CSV or Excel (.xlsx). You&apos;ll see what we found before anything is saved.</span>
        </button>

        {/* Preview — confirm before writing to Drive */}
        {pending && (
          <Card className="border-primary/40">
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Found <span className="font-mono tabular-nums">{pending.count}</span> transaction{pending.count === 1 ? "" : "s"}
                  {pending.from && pending.to && (
                    <> from {formatShortDate(pending.from)} to {formatShortDate(pending.to)}</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pending.name}
                  {pending.skipped > 0 && ` · ${pending.skipped} row${pending.skipped === 1 ? "" : "s"} we couldn't read will be skipped`}
                  . Transactions you&apos;ve already added won&apos;t be counted twice.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={confirmImport} className="flex-1 sm:flex-none">Add to Monera</Button>
                <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <RevolutExportHelp />

        {/* Status */}
        {status !== "idle" && (
          <Card className={cn(
            status === "error" ? "border-destructive/50" : status === "success" ? "border-status-ok/40" : "border-border"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {status === "success" ? (
                  <CheckCircle size={18} className="text-status-ok shrink-0 mt-0.5" />
                ) : status === "error" ? (
                  <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                ) : (
                  <Loader2 size={16} className="animate-spin text-primary shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-foreground" role={status === "error" ? "alert" : "status"}>{message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recurring bills nudge — shown once after a successful import */}
        {status === "success" && !settings.recurringNudgeDismissed && (
          <Card className="border-primary/30 bg-primary/3">
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <p className="text-sm text-foreground leading-relaxed">
                Pay rent or insurance from another account? Add them as bills so Safe to spend sets that money aside.{" "}
                <button
                  type="button"
                  onClick={() => router.push("/settings?tab=bills")}
                  className="underline underline-offset-2 font-medium hover:text-primary transition-colors"
                >
                  Add bills
                </button>
              </p>
              <button
                onClick={() => updateSettings({ ...settings, recurringNudgeDismissed: true })}
                type="button"
                className="shrink-0 p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Existing files */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Your statements</h2>
            <Button variant="ghost" size="sm" onClick={loadFiles}>Refresh</Button>
          </div>

          {existingFiles.length === 0 ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground text-center py-4">No statements added yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-3">
                <div className="divide-y divide-border">
                  {existingFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 py-3 px-2">
                      <FileText size={16} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(file.createdTime)}</p>
                      </div>
                      {confirmDeleteId === file.id ? (
                        <button
                          onClick={() => handleDelete(file.id)}
                          disabled={deletingId === file.id}
                          className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 disabled:cursor-wait transition-colors"
                        >
                          {deletingId === file.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(file.id)}
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
