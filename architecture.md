# Financial AI IDE Architecture

This document defines the architecture baseline and production target for a Cursor-like AI IDE tailored to financial institutions.

## 1) System Purpose

The platform enables analysts to ask natural-language questions and request spreadsheet operations, while keeping execution deterministic, controlled, and auditable.

Primary principle:

- AI interprets and plans.
- Deterministic services execute.
- Humans approve risky mutations.

## 2) Current Runtime Architecture

Core modules:

- `server/routes/ai.ts` - AI request entrypoint and high-level request routing.
- `server/pipeline/runAiPipeline.ts` - planning orchestration, confidence gate, pending operation creation.
- `server/agents/intentClassifier.ts` - intent and scope classification.
- `server/agents/financialPlanner.ts` - structured operation plan generation.
- `server/engine/pendingOps.ts` - pending operations persistence (Supabase or in-memory fallback).
- `server/routes/spreadsheet.ts` - review endpoints (`pending`, `accept`, `reject`, `audit`).
- `server/lib/modelRouterClient.ts` + `server/model-router/*` - provider/model selection and invocation.

Current flow:

1. Request received and validated.
2. Classifier infers intent.
3. Low-risk/non-operational prompts return conversational or file-aware responses.
4. Operational prompts enter planning pipeline.
5. Planner returns action list.
6. Formulas are validated.
7. Actions become pending operations.
8. Human accept/reject drives final execution and audit logging.

## 3) Target Production Architecture

### A) Experience Layer

- Web IDE for analyst workflows (chat, sheet context, operation review, trace view).
- Mode switching: `chat`, `analyze`, `propose_actions`, `review`.

### B) AI Control Plane

- Classifier, planner, and verifier services with strict JSON contracts.
- Model router with provider health, timeout, retry, and cost-aware policies.
- Prompt/version registry with controlled rollout.

### C) Policy and Governance Plane

- Regulator rule engine (CBK, SASRA, IRA, RBA, CMA).
- RBAC + maker-checker approvals.
- Action allow/deny lists by role, institution type, and risk class.

### D) Deterministic Execution Plane

- Formula compiler/validator and deterministic numeric engine.
- Versioned execution semantics to avoid silent behavior drift.
- Idempotent command processing.

### E) Data and Audit Plane

- Durable stores for:
  - uploaded table metadata/content references
  - pending operations
  - execution results
  - immutable audit events
- Full traceability from prompt to outcome.

### F) Observability and Reliability Plane

- Structured logging, metrics, traces, and stage-level error taxonomy.
- Alerting for model failures, validation failures, execution anomalies, and approval delays.

## 4) Architectural Contracts

- All external AI outputs must pass schema validation (Zod/JSON schema) before use.
- Contracts must be versioned (`schemaVersion`, `policyVersion`, `modelRouteVersion`).
- Request-to-response trace ID is mandatory for every API call.
- Critical operations must be replayable with deterministic outcomes.

## 5) Security and Compliance Baseline

- JWT-based authentication on protected APIs.
- Role-based authorization for read, propose, review, execute, and export actions.
- Least-privilege access between services.
- Encryption in transit and at rest.
- Tamper-evident audit storage and regulated retention/export support.

## 6) What Is Already Strong

- Correct separation between AI planning and human approval.
- Model routing abstraction already present.
- Formula validation and audit write path already implemented.
- Good initial domain framing around Kenyan regulator contexts.

## 7) Key Production Gaps

- Remaining in-memory fallback stores should be removed or restricted to development mode.
- Policy engine is not yet first-class (rules are still partly embedded in code/prompt logic).
- Orchestration does not yet expose explicit workflow state machine with retries and compensation.
- Observability needs standardized metrics/traces at each stage.
- End-to-end regression and adversarial evaluation suites are still limited.

## 8) Priority Architecture Roadmap

1. Introduce policy engine and config/versioned regulatory rules store.
2. Add orchestrator state machine persistence and idempotency controls.
3. Replace development-memory stores with durable production data services.
4. Add complete observability contract and dashboards.
5. Add evaluation harness and release gate for model/prompt/policy changes.

