# Financial AI IDE Rules

This document defines non-negotiable engineering and compliance rules for the Meridian Financial AI IDE.

## 1) Product Rules

- The product behaves like an AI coding/analysis copilot for financial teams, but never bypasses regulatory controls.
- AI can propose actions and explanations, but only deterministic services can compute financial outcomes.
- Every high-impact action must be reviewable, attributable, and auditable.
- No feature is considered complete without safety checks, logs, and test coverage.

## 2) Architecture Rules

- Keep strict separation of concerns:
  - `routes` = transport and request validation
  - `agents` = AI interpretation/planning only
  - `engine` = deterministic execution and state mutation
  - `pipeline` = orchestration and gating
- AI outputs must be schema-validated before use.
- No direct LLM-to-database writes for critical business operations.
- Execution paths must be idempotent and replay-safe.

## 3) Compliance and Governance Rules

- Enforce maker-checker for operational actions:
  - maker submits
  - checker approves/rejects
- Every decision must carry:
  - user identity
  - role
  - regulator context
  - model route/version
  - policy version
  - timestamp
- Sensitive data must be masked or redacted in model prompts where possible.
- Retention and export rules must support regulator audits (CBK, SASRA, IRA, RBA, CMA as applicable).

## 4) Security Rules

- All mutation endpoints require authenticated and authorized users.
- RBAC is mandatory:
  - `read-only`: query/report only
  - `analyst`: request analysis and proposals
  - `reviewer`/`admin`: approve, reject, rollback, and export audit
- Secrets are loaded from environment or secret manager only; never commit secrets.
- All external model calls must pass through router/client wrappers with centralized controls.

## 5) Data Rules

- In-memory stores are development-only and must not be relied on in production.
- Persist pending operations, audit events, and execution results in durable storage.
- Use schema-versioned records for plans and execution artifacts.
- Ensure tenant-level data isolation for multi-institution deployments.

## 6) AI and Prompt Rules

- Prompts must not define contracts that disagree with TypeScript/Zod contracts.
- Classifier and planner outputs must use strict JSON and explicit enums.
- AI confidence scores are advisory; policy gates determine actionability.
- High-risk intents (provisioning, report generation, data updates) require deterministic validation before review.

## 7) Quality Rules

- Add tests for:
  - intent classification contract validity
  - plan schema validity
  - deterministic execution outputs
  - audit trail completeness
- Add regression suites for known financial workflows (for example provisioning).
- Add failure tests for malformed model output and missing context.

## 8) Operational Rules

- Define SLOs for:
  - API latency
  - model routing success
  - fallback rates
  - approval workflow completion time
- Emit structured logs with correlation IDs on every request.
- Add alerting for repeated model parse failures, validation failures, and execution errors.

## 9) Release Rules

- Production changes require:
  - migration plan
  - rollback plan
  - risk assessment
  - test evidence
- Do not promote model, prompt, or policy changes without evaluation results.
- Keep a change log for model routes, policy versions, and formula templates.
