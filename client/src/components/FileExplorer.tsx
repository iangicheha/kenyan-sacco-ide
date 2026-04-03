import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Upload,
  Clock,
  Trash2,
} from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size?: string;
  modified?: string;
  icon?: React.ReactNode;
}

interface FileExplorerProps {
  onFileSelect?: (fileId: string) => void;
  onUpload?: () => void;
}

export function FileExplorer({ onFileSelect, onUpload }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["projects", "uploads"])
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const files: Record<string, FileItem[]> = {
    projects: [
      {
        id: "proj-1",
        name: "January Trial Balance",
        type: "file",
        size: "245 KB",
        modified: "2 hours ago",
      },
      {
        id: "proj-2",
        name: "M-Pesa Statements",
        type: "file",
        size: "1.2 MB",
        modified: "1 day ago",
      },
      {
        id: "proj-3",
        name: "Member Register",
        type: "file",
        size: "890 KB",
        modified: "3 days ago",
      },
    ],
    uploads: [
      {
        id: "upload-1",
        name: "Bank Statement PDF",
        type: "file",
        size: "2.5 MB",
        modified: "5 minutes ago",
      },
      {
        id: "upload-2",
        name: "Loan Listing CSV",
        type: "file",
        size: "156 KB",
        modified: "1 hour ago",
      },
    ],
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileSelect = (fileId: string) => {
    setSelectedFile(fileId);
    onFileSelect?.(fileId);
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
        <span className="text-sm font-semibold text-foreground">Explorer</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onUpload}
          title="Upload file"
        >
          <Upload className="w-4 h-4" />
        </Button>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-1">
          {Object.entries(files).map(([folderId, fileList]) => {
            const isExpanded = expandedFolders.has(folderId);

            return (
              <div key={folderId}>
                {/* Folder Header */}
                <button
                  onClick={() => toggleFolder(folderId)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors text-sm text-foreground"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  )}
                  <Folder className="w-4 h-4 flex-shrink-0 text-accent" />
                  <span className="capitalize font-medium">{folderId}</span>
                </button>

                {/* Files in Folder */}
                {isExpanded && (
                  <div className="ml-6 space-y-0.5">
                    {fileList.map((file) => (
                      <div
                        key={file.id}
                        onClick={() => handleFileSelect(file.id)}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                          selectedFile === file.id
                            ? "bg-accent/20 border border-accent"
                            : "hover:bg-muted"
                        }`}
                      >
                        <File className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{file.size}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{file.modified}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="p-1 hover:bg-destructive/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-sidebar">
        <p className="text-xs text-muted-foreground">
          Tip: Drag and drop files to upload
        </p>
      </div>
    </div>
  );
}
