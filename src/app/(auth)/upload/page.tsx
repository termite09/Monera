"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { listFiles, uploadCSV } from "@/lib/google/drive";
import { parseRevolutCSV } from "@/lib/parser/revolut";
import { formatDate } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  createdTime: string;
}

export default function UploadPage() {
  const { accessToken } = useAuth();
  const { structure } = useDrive(accessToken);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [existingFiles, setExistingFiles] = useState<UploadedFile[]>([]);
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
      const { transactions, errors } = parseRevolutCSV(content);

      await uploadCSV(accessToken, file.name, structure.revolutExportsId, content);

      setStatus("success");
      setMessage(`Uploaded ${file.name} — found ${transactions.length} transactions${errors.length > 0 ? `, ${errors.length} parse errors` : ""}`);
      await loadFiles();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }, [accessToken, structure, loadFiles]);

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
      <div className="p-4 max-w-2xl mx-auto space-y-4 pt-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Upload CSV</h1>
          <p className="text-sm text-gray-500 mt-1">Upload Revolut CSV exports to import transactions</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${dragging
              ? "border-[#1E3A5F] bg-[#1E3A5F]/5"
              : "border-gray-200 dark:border-gray-700 hover:border-[#1E3A5F] hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drag & drop CSV or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">Revolut export CSV files only</p>
        </div>

        {/* Status */}
        {status !== "idle" && (
          <Card className={status === "error" ? "border-red-200 dark:border-red-800" : status === "success" ? "border-emerald-200 dark:border-emerald-800" : ""}>
            <div className="flex items-start gap-3">
              {status === "success" ? (
                <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : status === "error" ? (
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              ) : (
                <div className="w-4 h-4 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
            </div>
          </Card>
        )}

        {/* Existing files */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Uploaded files</h2>
            <Button variant="ghost" size="sm" onClick={loadFiles}>Refresh</Button>
          </div>

          {existingFiles.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-400 text-center py-4">No files uploaded yet</p>
            </Card>
          ) : (
            <Card padding="sm">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {existingFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 py-3 px-2">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(file.createdTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
