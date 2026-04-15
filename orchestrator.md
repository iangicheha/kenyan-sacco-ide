# AI Orchestrator Design

This document defines the target orchestrator for a production-grade financial AI IDE.

## 1) Orchestrator Goals

- Route each user request to the safest and most efficient flow.
- Keep AI in interpretation and planning roles, not final computation for regulated outputs.
- Enforce policy gates before any state-changing action.
- Produce complete traces for observability and audits.

## 2) Current Pipeline (Implemented)

Main flow in `server/routes/ai.ts` and `server/pipeline/runAiPipeline.ts`:

1. Validate request schema.
2. Detect summary/chat edge cases.
3. Classify intent.
4. Route to:
   - conversational/file-answer flow, or
   - planning pipeline.
5. Planning pipeline:
   - build plan from intent
   - validate formulas
   - create pending operations
   - wait for human accept/reject via spreadsheet routes.

This is a good base and already follows a controlled AI-assisted workflow.

## 3) Target Production Orchestrator

Use a state machine/DAG style orchestrator with explicit stages:

1. `INGEST`
   - parse request
   - attach identity, role, tenant, session, correlation ID
2. `CLASSIFY`
   - infer intent with strict schema
   - calibrate confidence
3. `POLICY_GATE`
   - enforce regulator and RBAC rules
   - classify risk level
4. `PLAN`
   - generate structured plan
   - attach plan schema version and policy version
5. `VERIFY`
   - structural validation (schema/enums)
   - semantic validation (allowed columns/ranges)
   - safety checks (blocked actions, PII rules)
6. `REVIEW_QUEUE`
   - persist pending operations for maker-checker
7. `EXECUTE`
   - deterministic engine executes accepted actions
8. `POST_VERIFY`
   - reconcile outputs
   - detect anomalies
9. `AUDIT_EMIT`
   - write immutable event trail
10. `RESPOND`
   - return consistent response contract.

## 4) State Model

Operation lifecycle:

- `draft` -> `pending_review` -> `accepted` -> `executed` -> `verified` -> `closed`
- rejection branch: `pending_review` -> `rejected` -> `closed`
- failure branch: any state -> `failed` with reason and retry metadata

Each state transition must record:

- actor (`user_id`, `role`)
- timestamp
- input/output hash
- reason code
- correlation ID

## 5) Routing Strategy

Do not rely on regex-only gating for operational intent.

Preferred strategy:

- classifier-first routing
- fallback to safe conversational mode when confidence is low
- allow explicit client mode hints (`chat`, `analyze_file`, `plan_ops`) but still enforce policy checks server-side.

## 6) Reliability Patterns

- Add idempotency keys for state-changing requests.
- Use bounded retries with jitter for model provider calls.
- Implement circuit breaker per provider route.
- Queue long-running tasks and support async status checks.
- Add dead-letter queue for repeated execution failures.

## 7) Observability Contract

For every stage, emit:

- `stage_name`
- `started_at`, `ended_at`, `duration_ms`
- `status` (`ok`, `fallback`, `failed`)
- `error_code` (when applicable)
- `model_route` and `provider` (if AI stage)

Key dashboards:

- intent confidence distribution
- fallback and clarification rate
- plan validation failure rate
- approval turnaround time
- execution success rate

## 8) Required Next Upgrades

1. Introduce orchestrator stage telemetry in pipeline and routes.
2. Add policy-gate module as an explicit stage before plan acceptance.
3. Add persistent workflow state table for lifecycle tracking.
4. Add retry/idempotency framework around operational endpoints.
5. Add end-to-end orchestration tests for success and failure branches.
