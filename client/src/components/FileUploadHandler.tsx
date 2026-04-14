/**
 * FileUploadHandler.tsx
 *
 * Phase 2: Core Agentic Loop - XLSX/CSV Upload Pipeline
 *
 * Flow:
 * 1. User selects file(s)
 * 2. Create session via /upload
 * 3. Upload file(s) to session
 * 4. Parse and populate cell graph
 * 5. Return session ID for AI operations
 */

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

interface FileUploadHandlerProps {
  sessionId?: string;
  onSessionCreated?: (sessionId: string) => void;
  onUploadSuccess?: (data: { sessionId: string; fileName: string; rowCount: number }) => void;
  onUploadError?: (error: string) => void;
}

export function FileUploadHandler({
  sessionId: existingSessionId,
  onSessionCreated,
  onUploadSuccess,
  onUploadError,
}: FileUploadHandlerProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId || null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Filter to only XLSX and CSV
    const validFiles = files.filter(f =>
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls') ||
      f.name.endsWith('.csv')
    );
    setSelectedFiles(validFiles);
    setUploadStatus("idle");
  };

  const createSession = async () => {
    if (!selectedFiles.length) return null;

    setIsCreatingSession(true);
    try {
      const response = await fetch(apiUrl("/api/trpc/spreadsheet.upload"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionTitle: `Spreadsheet Session - ${selectedFiles[0].name}`,
          sessionDescription: `Uploaded ${selectedFiles.length} file(s)`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create session");
      }

      const result = await response.json();
      const newSessionId = result.result?.data?.sessionId;

      if (!newSessionId) {
        throw new Error("No session ID returned");
      }

      setSessionId(newSessionId);
      onSessionCreated?.(newSessionId);
      return newSessionId;
    } catch (error) {
      setUploadStatus("error");
      setStatusMessage(`Session creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      onUploadError?.(statusMessage);
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setStatusMessage("Please select at least one file.");
      setUploadStatus("error");
      return;
    }

    setIsUploading(true);
    setUploadStatus("uploading");
    setStatusMessage("Creating session and parsing files...");

    // Get or create session
    const currentSessionId = sessionId || await createSession();
    if (!currentSessionId) {
      setIsUploading(false);
      return;
    }

    // Upload and parse each file
    const results: Array<{ fileName: string; rowCount: number }> = [];

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", currentSessionId);

        const response = await fetch(apiUrl("/api/upload-file"), {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const result = await response.json();
        results.push({
          fileName: file.name,
          rowCount: result.rowCount || 0,
        });
      }

      setUploadStatus("success");
      setStatusMessage(`Successfully processed ${results.length} file(s). Total rows: ${results.reduce((a, b) => a + b.rowCount, 0)}`);
      onUploadSuccess?.({
        sessionId: currentSessionId,
        fileName: results[0]?.fileName || "unknown",
        rowCount: results.reduce((a, b) => a + b.rowCount, 0),
      });
      setSelectedFiles([]);
    } catch (error) {
      setUploadStatus("error");
      setStatusMessage(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      onUploadError?.(statusMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-foreground">Upload Files</span>
      </div>

      <input
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-accent-foreground hover:file:bg-accent/80"
      />

      {selectedFiles.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedFiles.length} file(s) selected: {selectedFiles.map(f => f.name).join(", ")}
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={isUploading || selectedFiles.length === 0}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          "Upload & Parse"
        )}
      </Button>

      {uploadStatus === "success" && (
        <div className="flex items-center gap-2 text-xs text-accent bg-accent/10 p-2 rounded border border-accent">
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {uploadStatus === "error" && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}
