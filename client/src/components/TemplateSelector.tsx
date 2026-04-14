/**
 * TemplateSelector.tsx
 *
 * Phase 3: Institution-Aware Template Engine
 *
 * Allows users to select from institution-specific templates
 * and create new sessions from templates.
 */

import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Building2,
  Scale,
  Calculator,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";

export type InstitutionType =
  | "bank"
  | "sacco"
  | "microfinance"
  | "insurance"
  | "pension"
  | "investment";

interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  institutionTypes: InstitutionType[];
  category: "financial_statement" | "regulatory" | "audit" | "analysis";
  regulatoryBody?: string;
  version: string;
}

interface TemplateCategory {
  [key: string]: TemplateMetadata[];
}

interface TemplateSelectorProps {
  institutionType: InstitutionType;
  onTemplateSelected?: (sessionId: string, templateName: string) => void;
}

const institutionLabels: Record<InstitutionType, string> = {
  bank: "Commercial Bank",
  sacco: "SACCO",
  microfinance: "Microfinance Institution",
  insurance: "Insurance Company",
  pension: "Pension Fund",
  investment: "Investment Fund",
};

const categoryIcons: Record<string, React.ReactNode> = {
  financial_statement: <FileSpreadsheet className="w-4 h-4" />,
  regulatory: <Scale className="w-4 h-4" />,
  audit: <Building2 className="w-4 h-4" />,
  analysis: <Calculator className="w-4 h-4" />,
};

const categoryLabels: Record<string, string> = {
  financial_statement: "Financial Statements",
  regulatory: "Regulatory Returns",
  audit: "Audit & Compliance",
  analysis: "Analysis & Reports",
};

export function TemplateSelector({
  institutionType,
  onTemplateSelected,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [categories, setCategories] = useState<TemplateCategory>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMetadata | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, institutionType]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiUrl("/api/trpc/spreadsheet.getTemplates")}?input=${encodeURIComponent(
          JSON.stringify({ institutionType })
        )}`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const result = await response.json();
      if (result.result?.data) {
        setTemplates(result.result.data.templates);
        setCategories(result.result.data.categories);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    try {
      const response = await fetch(
        apiUrl("/api/trpc/spreadsheet.createFromTemplate"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            templateId: selectedTemplate.id,
            institutionType,
            sessionTitle: `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create session from template");
      }

      const result = await response.json();
      const { sessionId, templateName } = result.result?.data || {};

      setIsOpen(false);
      onTemplateSelected?.(sessionId, templateName);
    } catch (error) {
      console.error("Error creating from template:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "financial_statement":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "regulatory":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "audit":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "analysis":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          New from Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Create from Template
          </DialogTitle>
          <DialogDescription>
            Select a template for{" "}
            <span className="font-medium text-foreground">
              {institutionLabels[institutionType]}
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No templates available for this institution type yet.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {Object.entries(categories).map(([category, categoryTemplates]) => (
                  <div key={category}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      {categoryIcons[category]}
                      {categoryLabels[category] || category}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {categoryTemplates.map((template) => (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedTemplate?.id === template.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-medium text-sm">
                                {template.name}
                              </h5>
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.description}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge
                                variant="outline"
                                className={`text-xs ${getCategoryColor(
                                  template.category
                                )}`}
                              >
                                {template.category}
                              </Badge>
                              {template.regulatoryBody && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {template.regulatoryBody}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateFromTemplate}
                disabled={!selectedTemplate || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create{" "}
                    {selectedTemplate ? `from ${selectedTemplate.name}` : ""}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
