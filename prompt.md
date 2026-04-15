You are a senior backend engineer working on a Node.js/TypeScript financial AI system.

Your task is to upgrade the system to enterprise production readiness without breaking existing functionality. Follow the architecture already in place (routes → pipeline → agents → engine).

Focus on implementing the following 5 upgrades:

--------------------------------------------------
1. Secure File APIs (CRITICAL)
--------------------------------------------------
- Locate where filesRouter is mounted (server/index.ts).
- Add requireAuth middleware to all file routes.
- Implement role-based access control:
  - admin: full access
  - reviewer: preview only (unless a dedicated file-approval workflow exists)
  - analyst: upload + preview
  - read-only: preview only
- Ensure upload and preview endpoints validate user permissions before access.
- Reject unauthorized requests with proper HTTP status codes (401/403).

--------------------------------------------------
2. Restrict CORS Policy
--------------------------------------------------
- Replace app.use(cors()) with strict configuration.
- Use environment-based allowlist:
  - development: allow localhost
  - production: allow only trusted domains
- Example:
  ALLOWED_ORIGINS=https://a.com,https://b.com
  origin: parsed allowlist array from ALLOWED_ORIGINS
- Reject all unknown origins.

--------------------------------------------------
3. Enforce Tenant Isolation (VERY CRITICAL)
--------------------------------------------------
- Modify JWT payload to include tenantId.
- Update requireAuth middleware to attach tenantId to request context.
- Enforce tenant filtering on ALL:
  - session reads
  - file access
  - audit logs
  - pipeline operations
- Ensure no cross-tenant data access is possible.
- Add helper:
  assertTenantAccess(resourceTenantId, userTenantId)

--------------------------------------------------
4. Upgrade Policy Engine
--------------------------------------------------
- Replace static policy logic with a DB-driven policy system.
- Create a Policy model with:
  - id
  - regulator
  - version
  - rules (JSON)
  - effective_from
  - effective_to
- Update planner/orchestrator to fetch active policy dynamically.
- Ensure versioning support (multiple policies can exist, only one active per time range).

--------------------------------------------------
5. Implement Retention & Archival
--------------------------------------------------
- Add retention rules for:
  - audit logs
  - telemetry
  - idempotency records
- Create background job (cron or worker) to:
  - delete expired records
  - archive important logs (optional: move to cold storage)
- Add config:
  RETENTION_DAYS_AUDIT
  RETENTION_DAYS_TELEMETRY

--------------------------------------------------
Constraints
--------------------------------------------------
- Do NOT break existing APIs or routes.
- Maintain backward compatibility.
- Use TypeScript types strictly.
- Add validation where needed.
- Keep code modular and clean.
- Add integration tests for:
  - 401/403 authorization failures
  - cross-tenant access denial on protected resources

--------------------------------------------------
Output Format
--------------------------------------------------
1. Show modified files
2. Show new middleware/helpers
3. Show schema/model additions
4. Brief explanation of each change