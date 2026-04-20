You are a senior backend engineer working on a Node.js/TypeScript financial AI system.

Current state:
- Foundation hardening is mostly complete (RBAC, idempotency, workflow telemetry, tenant scaffolding, tests).
- Your task now is to implement ONLY what is left for production readiness.
- Follow existing architecture: routes -> pipeline -> agents -> engine.
- Preserve backward compatibility where possible.

Implement the remaining work in this priority order.

--------------------------------------------------
1) Complete Phase 2: DB-driven Policy Engine
--------------------------------------------------
Goal:
- Replace static policy gating with a versioned, persistent policy model.

Required changes:
- Add a `policies` table/model (or equivalent data layer) with:
  - id
  - regulator
  - version
  - rules_json
  - effective_from
  - effective_to
  - is_active
  - created_at
- Add a policy repository/service:
  - getActivePolicy(regulator, atTime)
  - validatePolicyStructure(rules_json)
- Update policy gate/orchestrator to use active DB policy (not hardcoded thresholds).
- Attach `policyVersion` (and policy id where useful) to:
  - planning outputs
  - audit records
  - telemetry events

Acceptance criteria:
- System can hold multiple policy versions per regulator.
- Active policy is selected by time range and active flag.
- No high-risk operation proceeds without resolved policy.

--------------------------------------------------
2) Complete Tenant Isolation End-to-End
--------------------------------------------------
Goal:
- Ensure no cross-tenant data visibility or mutation is possible.

Required changes:
- Audit all routes and engine reads/writes for missing tenant filters.
- Add/centralize helper:
  - assertTenantAccess(resourceTenantId, userTenantId)
- Ensure tenant filter is enforced consistently across:
  - pending operations
  - audit logs
  - workflow transitions
  - orchestrator events
  - file previews/uploads
- Add negative tests explicitly proving cross-tenant denial.

Acceptance criteria:
- Every protected data access path includes tenant scoping.
- Cross-tenant requests fail with 403 and are logged.

--------------------------------------------------
3) Complete Retention & Archival Controls
--------------------------------------------------
Goal:
- Add production-grade data lifecycle management.

Required changes:
- Add retention configs:
  - RETENTION_DAYS_AUDIT
  - RETENTION_DAYS_TELEMETRY
  - RETENTION_DAYS_IDEMPOTENCY
- Implement retention jobs/service methods:
  - cleanupExpiredAuditRecords()
  - cleanupExpiredTelemetryRecords()
  - cleanupExpiredIdempotencyRecords() (extend existing if needed)
- Expose controlled admin endpoints and/or worker entrypoints for these jobs.
- Optional archival stub/interface for cold storage export.

Acceptance criteria:
- Retention jobs are testable and idempotent.
- Cleanup operations are role-protected and observable.

--------------------------------------------------
4) Start Phase 3: Reliability Runtime Controls
--------------------------------------------------
Goal:
- Improve operational resilience for AI/provider failures.

Required changes:
- Add provider retry policy with bounded retries + jitter.
- Add simple circuit-breaker state for failing providers/routes.
- Emit stage-level failure reason codes for retries/fallbacks.i want u to look
- Add a lightweight `/api/admin/metrics/orchestrator` summary endpoint.

Acceptance criteria:
- Repeated provider failures trigger fallback and breaker behavior.
- Metrics expose failure/fallback trends.

--------------------------------------------------
5) Testing and Verification (Mandatory)
--------------------------------------------------
Add/extend tests for:
- 401/403 auth/role denial
- cross-tenant denial
- policy version selection and enforcement
- retention cleanup correctness
- retry/fallback behavior in orchestrator/model routing path

Run and pass:
- pnpm test
- pnpm check

--------------------------------------------------
Constraints
--------------------------------------------------
- Do NOT remove existing endpoints.
- Keep API response contracts backward compatible unless change is justified and documented.
- Use strict TypeScript and Zod validation for new contracts.
- Keep changes modular (new services/helpers over large monolithic edits).
- No secrets in code or docs.

--------------------------------------------------
Output Format
--------------------------------------------------
1. Modified files list
2. New tables/models/services
3. Key behavior changes
4. Test results (`pnpm test`, `pnpm check`)
5. Remaining risks (if any)