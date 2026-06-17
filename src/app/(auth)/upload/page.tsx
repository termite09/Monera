"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { listFiles, uploadCSV, deleteFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  createdTime: string;
}

export default function UploadPage() {
  
  const { structure, refetch } = useAppData();
  const { accessToken } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    if (!accessToken || !structure) return;
    const files = await listFiles(
      accessToken,
      `'${structure.revolutExportsId}' in parents and mimeType='text/csv' and trashed=false`
    );
    setExistingFiles(files.map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime })));
  }, [accessToken, structure]);

  const handleFile = useCallback(async (file: File) => {
    if (!accessToken || !structure) return;

    setStatus("uploading");
    setMessage("Uploading...");

    try {
      const content = await file.text();
      const { transactions, errors } = parseCSV(content);
      await uploadCSV(accessToken, file.name, structure.revolutExportsId, content);
      setStatus("success");
      setMessage(`Uploaded ${file.name} — found ${transactions.length} transactions${errors.length > 0 ? `, ${errors.length} parse errors` : ""}`);
      await loadFiles();
      refetch();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }, [accessToken, structure, loadFiles]);

  const handleDelete = useCallback(async (fileId: string) => {
    if (!accessToken) return;
    setDeletingId(fileId);
    try {
      await deleteFile(accessToken, fileId);
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
      refetch();
    } catch {
      // Non-fatal: show nothing, file stays in list
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
      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Upload CSV</h1>
          <p className="text-sm text-muted-foreground mt-1">Import any bank CSV — Revolut is auto-detected, other formats are matched by their column headers</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary hover:bg-secondary"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Drag & drop CSV or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">CSV files — Revolut or any bank with date / description / amount columns</p>
        </div>

        {/* Status */}
        {status !== "idle" && (
          <Card className={cn(
            "shadow-none",
            status === "error" ? "border-destructive/50" : status === "success" ? "border-emerald-300 dark:border-emerald-800" : "border-border"
          )}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {status === "success" ? (
                  <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : status === "error" ? (
                  <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
                ) : (
                  <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-foreground">{message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing files */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Uploaded files</h2>
            <Button variant="ghost" size="sm" onClick={loadFiles}>Refresh</Button>
          </div>

          {existingFiles.length === 0 ? (
            <Card className="shadow-none border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground text-center py-4">No files uploaded yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-none border-border">
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
                          Confirm
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(confirmDeleteId === file.id ? null : file.id)}
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-secondary transition-colors"
                          aria-label="Delete file"
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
