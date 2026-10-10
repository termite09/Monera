"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Loader2, X } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { deleteFile } from "@/lib/google/drive";
import { listStatementFiles } from "@/lib/google/folders";
import { readStatement, saveStatement, statementErrorMessage, type StatementPreview } from "@/lib/statements";
import { formatDate, formatShortDate, cn, plural } from "@/lib/utils";
import { RevolutExportHelp } from "@/components/onboarding/RevolutExportHelp";

type Status = { kind: "idle" } | { kind: "working" | "success" | "error"; message: string };

export default function UploadPage() {
  const { accessToken, structure, settings, updateSettings, refetch } = useAppData();
  const qc = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState<StatementPreview | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filesKey = ["statements", structure?.statementsFolderId ?? "none"];
  const files = useQuery({
    queryKey: filesKey,
    queryFn: () => listStatementFiles(accessToken as string, structure!),
    enabled: !!accessToken && !!structure,
  });

  // Step 1: read and check the file locally. Nothing is written to Drive yet.
  const handleFile = async (file: File) => {
    setPending(null);
    setStatus({ kind: "working", message: "Reading your file…" });
    try {
      setPending(await readStatement(file));
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", message: statementErrorMessage(err) });
    }
  };

  // Step 2: the user confirmed — save the file to their Drive folder.
  const confirmImport = async () => {
    if (!accessToken || !structure || !pending) return;
    const statement = pending;
    setPending(null);
    setStatus({ kind: "working", message: "Adding to your Monera folder…" });
    try {
      await saveStatement(accessToken, structure, statement);
      setStatus({ kind: "success", message: `Added ${plural(statement.count, "transaction")}. Your dashboard is up to date.` });
      qc.invalidateQueries({ queryKey: filesKey });
      refetch();
    } catch (err) {
      setStatus({ kind: "error", message: statementErrorMessage(err) });
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!accessToken) return;
    setDeletingId(fileId);
    try {
      await deleteFile(accessToken, fileId);
      qc.invalidateQueries({ queryKey: filesKey });
      refetch();
    } catch (err) {
      setStatus({ kind: "error", message: statementErrorMessage(err, "Couldn't remove that file. Please try again.") });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const existingFiles = files.data ?? [];

  return (
    <PageShell>
      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-6 md:max-w-none md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Statements</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-[65ch]">
            Add your Revolut statement once per pay period.
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
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          disabled={status.kind === "working"}
          className={cn(
            "w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors disabled:cursor-wait",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-secondary"
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
                  {pending.from && pending.to && <> from {formatShortDate(pending.from)} to {formatShortDate(pending.to)}</>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pending.name}
                  {pending.skipped > 0 && ` · ${plural(pending.skipped, "row")} we couldn't read will be skipped`}
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

        {status.kind !== "idle" && (
          <Card className={cn(status.kind === "error" && "border-destructive/50")}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {status.kind === "success" ? (
                  <CheckCircle size={18} className="text-foreground shrink-0 mt-0.5" aria-hidden />
                ) : status.kind === "error" ? (
                  <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <Loader2 size={16} className="animate-spin text-primary shrink-0 mt-0.5" aria-hidden />
                )}
                <p className="text-sm text-foreground" role={status.kind === "error" ? "alert" : "status"}>{status.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recurring bills nudge — shown once after a successful import */}
        {status.kind === "success" && !settings.recurringNudgeDismissed && (
          <Card className="border-primary/30 bg-primary/3">
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <p className="text-sm text-foreground leading-relaxed">
                Pay rent or insurance from another account? Add them as bills so Safe to spend sets that money aside.{" "}
                <Link href="/settings?tab=bills" className="underline underline-offset-2 font-medium hover:text-primary transition-colors">
                  Add bills
                </Link>
              </p>
              <button
                onClick={() => updateSettings({ ...settings, recurringNudgeDismissed: true }).catch(() => {})}
                type="button"
                className="shrink-0 size-11 -m-3 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} aria-hidden />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Existing files */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Your statements</h2>
          <Card>
            <CardContent className={existingFiles.length > 0 ? "p-3" : "p-4"}>
              {files.isError ? (
                <p className="text-sm text-destructive text-center py-4" role="alert">{statementErrorMessage(files.error, "Couldn't load your statements. Please try again.")}</p>
              ) : files.isPending ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              ) : existingFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No statements added yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {existingFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 py-3 px-2">
                      <FileText size={16} className="text-muted-foreground shrink-0" aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(file.createdTime)}</p>
                      </div>
                      {confirmDeleteId === file.id ? (
                        <button type="button"
                          onClick={() => handleDelete(file.id)}
                          disabled={deletingId === file.id}
                          className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 disabled:cursor-wait transition-colors"
                        >
                          {deletingId === file.id ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Trash2 size={12} aria-hidden />}
                          Remove
                        </button>
                      ) : (
                        <button type="button"
                          onClick={() => setConfirmDeleteId(file.id)}
                          className="shrink-0 size-11 sm:size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
