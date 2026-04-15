# Production Readiness Roadmap

This roadmap turns the current prototype-quality platform into a production-grade financial AI IDE.

## Phase 1: Foundation Hardening (Weeks 1-3)

Goals:

- Remove hardcoded and fragile behavior from critical paths.
- Standardize contracts and observability.

Deliverables:

1. Policy-driven regulator config store (versioned).
2. Strict schema validation for all AI outputs and pipeline boundaries.
3. Correlation IDs and stage telemetry for route/pipeline/engine.
4. Disable in-memory fallbacks in production profile.
5. Baseline integration tests for main workflows.

Exit criteria:

- 100% critical endpoints emit traceable structured logs.
- No critical operation path depends on in-memory-only state in production mode.

## Phase 2: Governance and Workflow Control (Weeks 4-7)

Goals:

- Make approvals and controls regulator-ready.

Deliverables:

1. Explicit workflow state machine with persistent states.
2. Maker-checker enforcement with role constraints.
3. Risk-tiered policy gates (low/medium/high impact actions).
4. Immutable audit event stream with export integrity checks.
5. Idempotency keys for mutation endpoints.

Exit criteria:

- Every executed operation has a linked approved pending operation and complete audit trail.

## Phase 3: Reliability and Scale (Weeks 8-11)

Goals:

- Ensure system reliability under real institution workloads.

Deliverables:

1. Queue-based execution for long-running operations.
2. Retry and circuit breaker strategies for model providers.
3. Dashboards and alerts for SLOs and anomaly detection.
4. Multi-tenant isolation controls and tests.
5. Backfill/replay jobs for recovery and drift verification.

Exit criteria:

- SLOs defined, monitored, and met for p95 latency and execution success.

## Phase 4: ModelOps and Compliance Automation (Weeks 12-15)

Goals:

- Make model/prompt/policy evolution safe and measurable.

Deliverables:

1. Evaluation harness with golden datasets and adversarial tests.
2. Prompt/version registry with release approvals.
3. Shadow testing for route/model changes.
4. Compliance evidence pack generation (monthly/quarterly).
5. Incident playbooks for model regression and policy drift.

Exit criteria:

- No model/prompt/policy release without evaluation evidence.

## Cross-Cutting KPIs

- intent classification confidence calibration quality
- plan validation pass rate
- approval turnaround time
- execution success rate
- audit completeness rate
- fallback and clarification rates

## Immediate Next 5 Tickets

1. Add `correlation_id` propagation from `server/routes/ai.ts` into pipeline and audit writes.
2. Introduce `policyGate` stage before pending operation creation.
3. Persist workflow state transitions in a dedicated table.
4. Build end-to-end tests for accept/reject/execute/audit chain.
5. Add dashboard JSON metrics endpoint for orchestrator stage outcomes.
