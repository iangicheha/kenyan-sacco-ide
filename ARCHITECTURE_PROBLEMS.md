# What's Wrong With The Current Architecture

This document catalogs architectural problems, implementation anti-patterns, and missing capabilities compared to both Cursor AI patterns and financial industry best practices.

## 1. IN-MEMORY FALLBACK IS PRODUCTION-DANGEROUS

**Location**: `server/engine/idempotencyStore.ts`, `server/engine/pendingOps.ts`

**Problem**:
- `allowInMemoryFallback` environment flag enables production systems to silently lose durability
- Idempotency records stored in `Map<string, IdempotentValue>()` are process-local and will vanish on restart
- Pending operations in `pendingOpsStore: PendingOperation[]` array are not shared across horizontally scaled instances

**Why This Matters for Finance**:
- Duplicate execution of financial transactions during deployments or pod restarts
- Lost operations mean unapproved actions may never complete or be tracked
- No cross-instance consistency in a scaled deployment

**What Cursor Does**: No in-memory fallback. Ever.

**Fix**: Remove the flag entirely. Fail fast when Supabase is unavailable.

---

## 2. PARALLEL EXECUTION IS NOT IMPLEMENTED

**Location**: `server/pipeline/runAiPipeline.ts`

**Problem**:
- Pipeline stages execute sequentially even when independent
- Classification (40-200ms) blocks policy evaluation that could run simultaneously
- No `Promise.all()` for independent async operations

**Current Flow**:
```
classify (await) → policy_gate (await) → plan (await) → validate (await) → queue
```

**What Cursor Does**: "If you intend to call multiple tools and there are no dependencies between them, make all of the independent tool calls in parallel"

**Fix**: 
- Run CLASSIFY and initial POLICY_GATE in parallel when using cached rules
- Batch validation of multiple formulas concurrently

---

## 3. SYSTEM PROMPTS ARE HARD-CODED, NOT VERSIONED

**Location**: `server/agents/intentClassifier.ts` (lines 35-46), `server/agents/financialPlanner.ts`

**Problem**:
- System prompts embedded as template literals in source code
- No versioning mechanism for prompt changes
- No A/B testing or gradual rollout capability
- No separation between prompt content and business logic

**Current Pattern**:
```typescript
const system = `You are a Meridian Financial AI intent classifier for Kenyan SACCOs...

Return strict JSON with these keys:
- "intent": one of [...]
...`
```

**What Cursor Does**: Dedicated prompt registry with versioning and controlled rollout

**Fix**: Move prompts to `server/prompts/{role}-{version}.txt` with a registry that loads by version

---

## 4. HARD-CODED CONFIDENCE THRESHOLD

**Location**: `server/pipeline/runAiPipeline.ts` (line 39)

**Problem**:
- `if (intent.confidence < 0.8)` is magic number embedded in code
- No calibration mechanism per intent type
- No feedback loop to adjust thresholds based on actual accuracy

**Why This Matters**:
- "calculate_provisioning" might need 0.9 confidence, "chat" might be fine at 0.7
- Cannot tune without code deployment

**Fix**: Thresholds should be configurable per intent with historical accuracy tracking

---

## 5. FALLBACK INTENT LOGIC IS FRAGILE

**Location**: `server/agents/intentClassifier.ts` (lines 61-77)

**Problem**:
```typescript
const text = input.toLowerCase();
if (text.includes("provision")) {
  return { intent: "calculate_provisioning", confidence: 0.97 };
}
```

- String matching on "provision" as fallback when Zod fails
- Returns artificially inflated confidence (0.97) for regex-based matches
- Mixes regex routing with ML classification unpredictably

**What Cursor Does**: Explicit classifier-first routing with clear fallback to conversational mode

**Fix**: Remove regex fallbacks. If classification fails, request clarification.

---

## 6. POLICY GATE LACKS ACTUAL RULE EVALUATION

**Location**: `server/engine/policyGate.ts`

**Problem**:
- `evaluatePolicyGate` only checks if intent is in `highRiskIntents` set
- No actual policy rule evaluation (column-level permissions, time-based restrictions)
- `rulesJson` is treated as opaque blob with hard-coded field access
- No differentiation between policy versions for same regulator

**Current Logic**:
```typescript
const highRiskIntents = new Set<string>(
  Array.isArray(activePolicy.rulesJson.highRiskIntents) ? ... : []
);
const risk = highRiskIntents.has(input.intent.intent) ? "high" : "medium";
```

**What Financial Systems Need**:
- Expression-based rules: `intent == "calculate_provisioning" AND user.role == "senior_analyst" AND time.hour >= 9 AND time.hour <= 17`
- Audit trail of which specific rule allowed/denied

**Fix**: Implement expression evaluator for rules, not just intent set membership

---

## 7. CIRCUIT BREAKER DOESN'T PROTECT MODEL ROUTER

**Location**: `server/lib/modelRouterClient.ts`, `server/lib/retryWithBackoff.ts`

**Problem**:
- `retryWithCircuitBreaker` wraps calls but doesn't track per-provider state
- No circuit breaker state visible to routing decisions
- If OpenRouter fails, subsequent requests still try OpenRouter before falling back

**What Cursor Does**: Circuit breaker per provider route with health-based routing

**Fix**: Circuit breaker should update routing catalog health scores

---

## 8. WORKFLOW STATE MACHINE IS NOT ENFORCED

**Location**: `server/engine/workflowState.ts`, `server/pipeline/runAiPipeline.ts`

**Problem**:
- `appendWorkflowTransition` logs state changes but doesn't enforce valid transitions
- No validation that `pending_review` → `executed` is invalid (must go through `accepted`)
- State transitions are advisory, not authoritative

**Current Pattern**:
```typescript
await appendWorkflowTransition({ fromState: "pending_review", toState: "accepted", ... });
// No enforcement that this is actually a valid transition
```

**Fix**: State machine should reject invalid transitions at the database level

---

## 9. NO COMPENSATION TRANSACTIONS

**Problem**:
- Pipeline has no rollback/compensation mechanism
- If `acceptOperation` fails after `markOperationAccepted`, operation is stuck in inconsistent state
- No saga pattern for multi-step operations

**Fix**: Implement compensation actions for each stage

---

## 10. INCOMPLETE TYPE SAFETY AT API BOUNDARIES

**Location**: Multiple route files

**Problem**:
- Express routes don't consistently validate request bodies with Zod
- Some routes use `as Type` casting without validation
- `sheetData?: Record<string, string | number | boolean | null>` accepts null without distinguishing between "empty" and "missing"

**Fix**: Strict Zod validation on all API entrypoints with typed error responses

---

## 11. ERROR MESSAGES LEAK IMPLEMENTATION DETAILS

**Location**: `server/pipeline/runAiPipeline.ts`

**Problem**:
```typescript
return { status: "validation_error" as const, error: validation.errorMessage ?? "Invalid formula.", action };
```

- Error message from formula validator may expose internal formula structure
- `cross_tenant` errors reveal that multi-tenancy exists (information leak)

**Fix**: Error messages should be generic to API consumers, detailed in logs only

---

## 12. TELEMETRY IS NOT STRUCTURED METRICS

**Location**: `server/engine/orchestratorTelemetry.ts`

**Problem**:
- Events are emitted but no aggregation mechanism
- No Prometheus/CloudWatch metrics
- No latency histograms, only durationMs on individual events
- No alerting on stage failure rates

**What Cursor Does**: Metrics dashboard with stage-level error taxonomy

**Fix**: Export metrics in standard format (Prometheus, OTel)

---

## 13. MODEL ROUTER LACKS COST TRACKING

**Location**: `server/model-router/router.ts`

**Problem**:
- Route selection considers latency but not cost
- No per-request cost attribution
- No budget enforcement per tenant

**Fix**: Add cost field to routing decisions with per-tenant budgets

---

## 14. NO PERSISTENT QUEUE FOR LONG-RUNNING OPERATIONS

**Problem**:
- All operations are synchronous HTTP requests
- Complex planning may timeout (no async job support)
- No dead-letter queue for failed operations

**Fix**: Queue-based architecture for planning stage with webhook callbacks

---

## 15. CITATION SYSTEM MISSING

**Problem**:
- No way to reference specific cells/tables in audit logs with precision
- Cursor uses `startLine:endLine:filepath` for code citations
- Financial equivalent would be: `table:column:row:version` citations

**Fix**: Add citation format to all operations referencing sheet data

---

## 16. NO INPUT HASHING FOR REPLAY

**Problem**:
- `correlationId` tracks requests but no content hash
- Cannot verify if replay produces identical results
- No merkle tree for audit trail integrity

**Fix**: Hash inputs at each stage for verifiable replay

---

## 17. TENANT ISOLATION NOT ENFORCED AT DATABASE LEVEL

**Location**: `server/engine/pendingOps.ts`

**Problem**:
```typescript
if (existing && existing.tenantId !== input.tenantId) {
  return { status: "forbidden" as const };
}
```

- Tenant check happens in application code, not database query
- Race condition: row could be modified between fetch and check

**Fix**: Database RLS policies or at least query-level tenant filtering

---

## 18. NO SCHEMA MIGRATION STRATEGY

**Problem**:
- `server/supabase/schema.sql` exists but no migration versioning
- No rollback strategy for schema changes
- No data migration scripts between versions

**Fix**: Implement migration framework (Flyway, Liquibase, or Supabase migrations)

---

## 19. DETERMINISTIC EXECUTION NOT VERIFIED

**Location**: `server/engine/formulaExecutor.ts`

**Problem**:
- No proof that `executeFormulaRange` produces identical output for identical input
- Floating point operations may vary by Node.js version
- No golden file tests for regression

**Fix**: Property-based testing with seed-based verification

---

## 20. APPROVAL WORKFLOW IS SINGLE-USER

**Problem**:
- Maker-checker implies two different people, but system allows same user
- No separation of duty enforcement
- No escalation if checker doesn't respond

**Fix**: Enforce different users for maker/checker roles with timeout escalation

---

## Summary Table

| Issue | Severity | Effort to Fix |
|-------|----------|---------------|
| In-memory fallback | CRITICAL | Low |
| No parallel execution | MEDIUM | Medium |
| Hard-coded prompts | MEDIUM | Medium |
| Hard-coded thresholds | LOW | Low |
| Regex fallback | MEDIUM | Low |
| Weak policy engine | HIGH | High |
| Circuit breaker gaps | MEDIUM | Medium |
| State machine unenforced | HIGH | Medium |
| No compensation | MEDIUM | High |
| Incomplete type safety | MEDIUM | Medium |
| Error leak | LOW | Low |
| No metrics aggregation | MEDIUM | Medium |
| No cost tracking | LOW | Medium |
| No persistent queue | MEDIUM | High |
| No citations | LOW | Low |
| No input hashing | MEDIUM | Medium |
| Tenant isolation gap | HIGH | Low |
| No migrations | MEDIUM | Low |
| Determinism unverified | MEDIUM | High |
| Single-user approval | HIGH | Medium |

---

## Recommended Priority Order

1. **Remove in-memory fallback** (production safety)
2. **Fix tenant isolation** (security)
3. **Implement state machine enforcement** (correctness)
4. **Add expression-based policy rules** (compliance)
5. **Add parallel execution** (performance)
6. **Version system prompts** (maintainability)
7. **Add metrics aggregation** (observability)
