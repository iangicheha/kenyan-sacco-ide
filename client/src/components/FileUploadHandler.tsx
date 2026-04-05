import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface FileUploadHandlerProps {
  onUploadSuccess?: (data: any) => void;
  onUploadError?: (error: string) => void;
}

export function FileUploadHandler({ onUploadSuccess, onUploadError }: FileUploadHandlerProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setUploadStatus("idle");
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setStatusMessage("Please select at least one file.");
      setUploadStatus("error");
      return;
    }

    setIsUploading(true);
    setUploadStatus("uploading");
    setStatusMessage("Uploading and parsing files...");

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append("files", file));

    try {
      const response = await fetch("http://localhost:3001/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const result = await response.json();
      setUploadStatus("success");
      setStatusMessage(`Successfully uploaded ${selectedFiles.length} file(s).`);
      onUploadSuccess?.(result.data);
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
