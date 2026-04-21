import { env } from "../config/env.js";
import { getSupabase } from "./supabase.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type PromptStage =
  | "intent_classifier"
  | "financial_planner"
  | "chat_assistant"
  | "file_analyst";

export interface ResolvedPrompt {
  stage: PromptStage;
  promptId: string;
  version: number;
  template: string;
}

const defaultPromptCatalog: Record<PromptStage, { promptId: string; version: number }> = {
  intent_classifier: {
    promptId: "intent_classifier",
    version: 1,
  },
  financial_planner: {
    promptId: "financial_planner",
    version: 1,
  },
  chat_assistant: {
    promptId: "chat_assistant",
    version: 1,
  },
  file_analyst: {
    promptId: "file_analyst",
    version: 1,
  },
};

async function loadPromptFromFile(promptId: string, version: number): Promise<string | null> {
  try {
    const filePath = path.join(__dirname, "..", "prompts", `${promptId}-v${version}.txt`);
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load prompt from file: ${promptId}-v${version}`, error);
    return null;
  }
}

function renderTemplate(template: string, context?: Record<string, string | number | boolean | null | undefined>): string {
  if (!context) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function resolvePrompt(
  stage: PromptStage,
  context?: Record<string, string | number | boolean | null | undefined>
): Promise<ResolvedPrompt> {
  const fallback = defaultPromptCatalog[stage];
  
  // Try to load from prompt registry (Supabase) if enabled
  if (env.promptRegistryEnabled) {
    const supabase = getSupabase();
    if (supabase) {
      const binding = await supabase
        .from("prompt_bindings")
        .select("active_prompt_version_id")
        .eq("stage", stage)
        .limit(1);
      
      if (!binding.error && binding.data && binding.data.length > 0) {
        const activeId = binding.data[0].active_prompt_version_id;
        const record = await supabase
          .from("prompt_registry")
          .select("prompt_id, version, template, status")
          .eq("id", activeId)
          .eq("status", "active")
          .limit(1);
        
        if (!record.error && record.data && record.data.length > 0) {
          const row = record.data[0];
          return {
            stage,
            promptId: row.prompt_id,
            version: row.version,
            template: renderTemplate(row.template, context),
          };
        }
      }
    }
  }

  // Fallback to local file system
  const fileTemplate = await loadPromptFromFile(fallback.promptId, fallback.version);
  if (fileTemplate) {
    return {
      stage,
      promptId: fallback.promptId,
      version: fallback.version,
      template: renderTemplate(fileTemplate, context),
    };
  }

  // Final fallback (should not happen if files are present)
  return {
    stage,
    promptId: fallback.promptId,
    version: fallback.version,
    template: renderTemplate("Error: Prompt template not found.", context),
  };
}
