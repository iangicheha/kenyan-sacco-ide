# AI Backend Architecture

This document describes how the AI backend works end-to-end in this project, including request flow, routing logic, model selection, file-context handling, and operation pipelines.

## 1) High-Level Architecture

The backend is an Express server with feature routers. AI behavior is centered around:

- `server/index.ts` (route mounting + server boot)
- `server/routes/ai.ts` (main AI controller for `/api/ai/chat`)
- `server/lib/modelRouterClient.ts` (provider/model invocation layer)
- `server/model-router/*` (model catalog + deterministic route selection)
- `server/pipeline/runAiPipeline.ts` (operation-planning workflow)
- `server/routes/files.ts` + `server/data/uploadStore.ts` (uploaded file ingestion and in-memory context)

There are effectively two AI modes:

1. **Conversational/File Q&A mode** (normal chat-like responses)
2. **Operational planning mode** (returns pending spreadsheet actions for human approval)

## 2) Entry Point and Route Mounting

In `server/index.ts`:

- `app.use("/api/ai", requireAuth, aiRouter)` protects AI chat endpoint with JWT auth.
- `app.use("/api/spreadsheet", requireAuth, spreadsheetRouter)` handles accept/reject/pending operations.
- `app.use("/api/files", filesRouter)` handles file upload and preview.
- `app.use("/api", filesRouter)` keeps backward compatibility aliases (`/api/upload`, etc.).

All AI calls from UI eventually hit:

- `POST /api/ai/chat`

## 3) Authentication Boundary

`server/middleware/auth.ts` enforces Bearer token auth:

- Missing token -> `401 Missing bearer token`
- Invalid/expired token -> `401 Invalid or expired token`
- Valid token -> request continues with `req.user`

This means AI routes are authenticated by design.

## 4) AI Request Contract

In `server/routes/ai.ts` request schema:

- `sessionId: string` (required)
- `prompt: string` (required)
- `regulator: "CBK" | "SASRA" | "IRA" | "RBA" | "CMA"` (default `CBK`)
- `fileName?: string`
- `sheetName?: string`

`fileName/sheetName` enable contextual Q&A against uploaded spreadsheet data.

## 5) Decision Flow in `ai.ts`

`POST /chat` in `server/routes/ai.ts` acts as the orchestrator.

### Branch A: Explicit file summary intent

If prompt matches file-summary patterns (`wantsFileSummary`), returns summary from uploaded sheet:

- status: `file_summary`
- includes row count, headers, sample rows, and human summary text

### Branch B: Greeting/small talk

If prompt is greeting/small talk (`isGreetingOrSmallTalk`), it forces normal conversational mode:

- status: `chat`
- message: conversational model output

### Branch C: Non-operational prompt

If prompt does **not** match operational plan intent (`wantsOperationalPlan`):

- If file context exists: tries contextual file Q&A (`answerFileQuestionWithModel`)
- Otherwise: uses generic conversational path (`answerConversationally`)

Returns typically:

- `chat`
- `file_answer`
- `file_summary`

### Branch D: Operational prompt

If prompt looks like action request (formula/apply/calculate/update/etc.), route to planning pipeline:

- `runPlanningPipeline(...)`
- expected response on success: `pending_review` + pending operations list

Fallback behavior:

- If pipeline returns `clarification_required` and file context exists, it attempts contextual file answer first, then falls back to file summary.

## 6) Uploaded File Context Lifecycle

### Upload ingest

`server/routes/files.ts`:

- `POST /api/files/upload` accepts multipart `files`
- parses CSV/XLS/XLSX
- stores parsed sheet data in memory via `setUploadedFileSheets(...)`

### Shared in-memory store

`server/data/uploadStore.ts`:

- global in-process map of `fileName -> sheets -> rows/headers`
- APIs:
  - `setUploadedFileSheets(...)`
  - `getUploadedSheet(...)`
  - `getUploadedFileSheetNames(...)`

### Preview pagination

`GET /api/files/upload/preview` returns paged row slices from store.

Important: this store is **memory-only**; restart clears cache.

## 7) Model Routing Layer

### Catalog

`server/model-router/catalog.ts` defines provider and model candidates:

- Providers: `ollama`, `groq`, `openrouter`, `claude`
- Availability of external providers depends on env keys.
- Default ollama stack:
  - primary: `env.ollamaModel`
  - fallback: `env.ollamaFallbackModel`
  - fast: `env.ollamaFastModel`

### Deterministic route selection

`server/model-router/router.ts`:

- filters ineligible candidates (provider health, availability, context window, JSON/tool requirements)
- scores by:
  - quality (40%)
  - latency (20%)
  - cost (20%)
  - task capability (20%)
- deterministic tie-breaking and fallback selection
- emits execution policy (timeout/retry)

### Invocation client

`server/lib/modelRouterClient.ts`:

- dispatches to provider-specific clients
- currently expects JSON outputs via `askRoutedJson<T>()`
- ollama calls:
  - `POST {OLLAMA_BASE_URL}/api/generate`
  - `Authorization: Bearer OLLAMA_API_KEY` when present
  - `format: "json"`

If primary fails, uses route fallback model/provider.

## 8) Planning / Operations Pipeline

`server/pipeline/runAiPipeline.ts`:

1. `classifyIntent(...)`
2. confidence gate (`< 0.8` -> `clarification_required`)
3. `buildFinancialPlan(...)`
4. validates formula actions
5. creates pending formula operations
6. returns `pending_review`

Related modules:

- `server/agents/intentClassifier.ts` (LLM classification with fallback heuristic)
- `server/agents/financialPlanner.ts` (LLM plan generation with deterministic fallback)
- `server/engine/pendingOps.ts` (Supabase or in-memory pending ops store)

## 9) Operation Review and Execution

`/api/spreadsheet/*` endpoints handle lifecycle:

- list pending
- accept operation -> apply formula execution -> append audit log
- reject operation

This keeps “AI suggests / human approves” behavior explicit.

## 10) Response Types You Can See

Typical `POST /api/ai/chat` statuses:

- `chat` - normal conversational response
- `file_answer` - contextual answer from file data
- `file_summary` - file overview (rows/headers/sample)
- `pending_review` - operation proposals awaiting approval
- `clarification_required` - low-confidence planning intent
- `validation_error` - invalid generated formula

Frontend should render these as user-friendly messages (not raw status where possible).

## 11) Environment Dependencies

Key env vars used by AI backend:

- `PORT`
- `JWT_SECRET`
- `OLLAMA_BASE_URL`
- `OLLAMA_API_KEY`
- `OLLAMA_MODEL`
- `OLLAMA_FALLBACK_MODEL`
- `OLLAMA_FAST_MODEL`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `ANTHROPIC_API_KEY` (+ Claude model vars)

Provider availability logs are printed at startup.

## 12) Known Operational Characteristics

- Uploaded file context is in-memory and lost on backend restart.
- Model calls currently enforce JSON-style outputs in routed client path.
- Conversational quality is tied to route selection and provider/model availability.
- If model output cannot be parsed as expected JSON, fallback messages may appear.

## 13) Suggested Next Improvements

1. Persist upload context beyond process memory (DB/object store).
2. Separate plain-text chat transport from strict-JSON structured tasks.
3. Add request/response tracing IDs for easier debugging.
4. Add explicit mode flags in request (`chat`, `analyze_file`, `plan_actions`) instead of regex-only intent gating.
5. Add integration tests for:
   - greeting
   - file summary
   - file Q&A
   - operational planning
   - clarification fallback

