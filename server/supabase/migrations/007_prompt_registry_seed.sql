-- Migration 007: Phase 5 Prompt Registry Seed
-- Seeds default prompts into the registry for production use
-- This migration should be run after 006_rls_enforcement.sql

-- Seed intent_classifier prompt v1
insert into public.prompt_registry (
  prompt_id, version, template, input_schema, output_schema, model_hints, status, created_by, created_at, change_note
) values (
  'intent_classifier',
  1,
  'You are a Meridian Financial AI intent classifier for Kenyan SACCOs and financial institutions.

Analyze the user''s request and classify it into a structured intent.

Return strict JSON with these keys:
- "intent": one of ["calculate_provisioning", "classify_loans", "generate_report", "analyze_portfolio", "validate_data", "compute_ratios", "forecast", "unknown"]
- "scope": one of ["single_cell", "column_range", "sheet_range", "unknown"]
- "regulation": "CBK" | "SASRA" | "IRA" | "RBA" | "CMA"
- "confidence": number 0.0 to 1.0

Use SASRA/CBK guidelines for Kenyan SACCOs. When uncertain, use the provided fallbackRegulator.',
  '{"type": "object", "properties": {"input": {"type": "string"}, "fallbackRegulator": {"type": "string"}}}',
  '{"type": "object", "properties": {"intent": {"type": "string"}, "scope": {"type": "string"}, "regulation": {"type": "string"}, "confidence": {"type": "number"}}}',
  '{"preferred_models": ["claude-3-5-haiku-latest", "claude-sonnet-4-5"], "max_tokens": 500}',
  'active',
  'system',
  now(),
  'Initial version for production'
)
on conflict (prompt_id, version) do update set
  template = excluded.template,
  input_schema = excluded.input_schema,
  output_schema = excluded.output_schema,
  model_hints = excluded.model_hints,
  status = excluded.status,
  change_note = excluded.change_note;

-- Seed financial_planner prompt v1
insert into public.prompt_registry (
  prompt_id, version, template, input_schema, output_schema, model_hints, status, created_by, created_at, change_note
) values (
  'financial_planner',
  1,
  'You are a Meridian Financial AI planning engine for Kenyan SACCOs and financial institutions.

Create a structured execution plan for spreadsheet operations.

CRITICAL RULES:
- Return ONLY formulas; NEVER compute numerical results yourself
- Each formula must be valid Excel/Google Sheets syntax
- Reference specific column names or cell ranges
- Include regulatory citations where applicable
- Plans must be executable deterministically by the engine

Return strict JSON with key "plan" containing an array of steps. Each step has:
- "step": number (1-indexed)
- "action": "read_column" | "write_formula" | "write_value"
- "target": string (column name, cell reference, or range)
- "formula": string (Excel formula, for write_formula actions)
- "value": string | number | boolean | null (for write_value actions)
- "reasoning": string (brief explanation of why this step)
- "regulationReference": string (optional, e.g., "CBK/PG/15 Section 4.2")

Use Kenyan SACCO regulatory guidelines (CBK, SASRA) for provisioning and compliance.',
  '{"type": "object", "properties": {"analystPrompt": {"type": "string"}, "regulator": {"type": "string"}}}',
  '{"type": "object", "properties": {"plan": {"type": "array", "items": {"type": "object"}}}}',
  '{"preferred_models": ["claude-sonnet-4-5", "claude-3-5-haiku-latest"], "max_tokens": 2000}',
  'active',
  'system',
  now(),
  'Initial version for production'
)
on conflict (prompt_id, version) do update set
  template = excluded.template,
  input_schema = excluded.input_schema,
  output_schema = excluded.output_schema,
  model_hints = excluded.model_hints,
  status = excluded.status,
  change_note = excluded.change_note;

-- Seed chat_assistant prompt v1
insert into public.prompt_registry (
  prompt_id, version, template, input_schema, output_schema, model_hints, status, created_by, created_at, change_note
) values (
  'chat_assistant',
  1,
  'You are a Meridian Financial AI spreadsheet assistant for Kenyan SACCOs and financial institutions.

Provide clear, professional responses about spreadsheet data and financial operations.

GUIDELINES:
- Be concise and professional
- Reference specific columns, ranges, or cells when applicable
- Cite regulatory guidelines (CBK, SASRA, IRA, RBA, CMA) when relevant
- If file context is provided, base your answer on that data
- For calculations, explain the formula logic, not just the result

Return strict JSON: {"answer": "your response string"}',
  '{"type": "object", "properties": {"message": {"type": "string"}, "context": {"type": "object"}}}',
  '{"type": "object", "properties": {"answer": {"type": "string"}}}',
  '{"preferred_models": ["claude-3-5-haiku-latest", "claude-sonnet-4-5"], "max_tokens": 1000}',
  'active',
  'system',
  now(),
  'Initial version for production'
)
on conflict (prompt_id, version) do update set
  template = excluded.template,
  input_schema = excluded.input_schema,
  output_schema = excluded.output_schema,
  model_hints = excluded.model_hints,
  status = excluded.status,
  change_note = excluded.change_note;

-- Seed file_analyst prompt v1
insert into public.prompt_registry (
  prompt_id, version, template, input_schema, output_schema, model_hints, status, created_by, created_at, change_note
) values (
  'file_analyst',
  1,
  'You are a Meridian Financial AI spreadsheet analyst for Kenyan SACCOs and financial institutions.

Analyze the provided spreadsheet data and provide structured insights.

GUIDELINES:
- Answer ONLY from the provided sheet context
- Reference specific column names, row ranges, or cell addresses
- Highlight anomalies, trends, or compliance issues where relevant
- If data is insufficient, clearly state what is missing
- For financial metrics, explain the calculation methodology
- Cite regulatory guidelines (CBK, SASRA) when applicable

Return strict JSON: {"answer": "your response string"}',
  '{"type": "object", "properties": {"sheetData": {"type": "object"}, "query": {"type": "string"}}}',
  '{"type": "object", "properties": {"answer": {"type": "string"}}}',
  '{"preferred_models": ["claude-sonnet-4-5", "claude-3-5-haiku-latest"], "max_tokens": 1500}',
  'active',
  'system',
  now(),
  'Initial version for production'
)
on conflict (prompt_id, version) do update set
  template = excluded.template,
  input_schema = excluded.input_schema,
  output_schema = excluded.output_schema,
  model_hints = excluded.model_hints,
  status = excluded.status,
  change_note = excluded.change_note;

-- Create prompt bindings for all stages
-- These map pipeline stages to active prompt versions

-- intent_classifier binding
insert into public.prompt_bindings (stage, active_prompt_version_id, updated_by, updated_at)
select
  'intent_classifier',
  id,
  'system',
  now()
from public.prompt_registry
where prompt_id = 'intent_classifier' and version = 1 and status = 'active'
on conflict (stage) do update set
  active_prompt_version_id = excluded.active_prompt_version_id,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

-- financial_planner binding
insert into public.prompt_bindings (stage, active_prompt_version_id, updated_by, updated_at)
select
  'financial_planner',
  id,
  'system',
  now()
from public.prompt_registry
where prompt_id = 'financial_planner' and version = 1 and status = 'active'
on conflict (stage) do update set
  active_prompt_version_id = excluded.active_prompt_version_id,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

-- chat_assistant binding
insert into public.prompt_bindings (stage, active_prompt_version_id, updated_by, updated_at)
select
  'chat_assistant',
  id,
  'system',
  now()
from public.prompt_registry
where prompt_id = 'chat_assistant' and version = 1 and status = 'active'
on conflict (stage) do update set
  active_prompt_version_id = excluded.active_prompt_version_id,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

-- file_analyst binding
insert into public.prompt_bindings (stage, active_prompt_version_id, updated_by, updated_at)
select
  'file_analyst',
  id,
  'system',
  now()
from public.prompt_registry
where prompt_id = 'file_analyst' and version = 1 and status = 'active'
on conflict (stage) do update set
  active_prompt_version_id = excluded.active_prompt_version_id,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

-- Comments documenting the migration
comment on table public.prompt_registry is 'Stores versioned prompts for AI pipeline stages. Each prompt has a unique (prompt_id, version) pair.';
comment on table public.prompt_bindings is 'Maps pipeline stages to active prompt versions. Stage is unique - only one active prompt per stage.';

-- Add helper function to activate a prompt version
-- This can be used by admin tools to rollback or promote prompts
comment on function public.set_config is 'Wrapper for pg_catalog.set_config to allow setting session variables via Supabase RPC.';
