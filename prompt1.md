# Missing Features: Production-Ready Financial AI IDE

This document lists all critical features, tools, and system prompts that are NOT yet implemented but are required for a production-grade Meridian AI-like financial IDE for Kenyan SACCOs.

---

## 1. Agent Tool Framework (CRITICAL)

**Current State:** Only 2 tools exist (`validateFormula`, `readRegulatoryConfig`). The AI cannot execute tools dynamically during conversations.

**Required Implementation:**

### 1.1 Tool Execution Engine
Create a tool registry and executor that allows agents to:
- Discover available tools with schemas
- Execute tools with validated parameters
- Handle tool errors gracefully
- Log tool usage for audit trails

### 1.2 Missing Tools to Implement

| Tool | Purpose | Priority |
|------|---------|----------|
| `calculate` | Deterministic math using mathjs library (already installed) | CRITICAL |
| `querySheet` | Read column/range data from uploaded files | CRITICAL |
| `computeRatio` | Pre-built financial ratio calculations (NPL, CAR, ROA, ROE, liquidity ratios) | HIGH |
| `fetchRegulatoryLimit` | Query CBK/SASRA limits dynamically | HIGH |
| `formatCurrency` | Format numbers as KES with proper locale | MEDIUM |
| `generateReport` | Compile structured reports from data | MEDIUM |
| `validateDataQuality` | Check for nulls, outliers, duplicates in sheet data | MEDIUM |

### 1.3 Tool Schema Example
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "array";
      required: boolean;
      description: string;
    };
  };
  returns: string;
}
```

---

## 2. Enhanced System Prompts (CRITICAL)

**Current State:** System prompts are hardcoded inline in agent files. No central prompt registry or versioning.

**Required Implementation:**

### 2.1 Central Prompt Registry
Create a prompt store with:
- Versioned prompts (prompt_version field)
- A/B testing support for prompt variants
- Prompt templates with variable interpolation
- Release gates (no prompt change without evaluation)

### 2.2 Missing System Prompts

| Prompt | Purpose | Location |
|--------|---------|----------|
| `orchestrator_system` | Master coordinator that decides which agent/tool to invoke | NEW |
| `verifier_system` | Post-execution validation of AI outputs | NEW |
| `security_guard_system` | Detect prompt injection, data exfiltration attempts | NEW |
| `report_writer_system` | Generate boardroom-ready reports | NEW |

### 2.3 Prompt Context Injection
Add dynamic context injection for:
- User's role and permissions
- Institution type (bank/sacco/mfi)
- Active regulator rules
- Session history summary

---

## 3. File API Authorization (CRITICAL)

**Current State:** `filesRouter` has auth but role-based access is incomplete.

**Required Implementation:**

### 3.1 Role-Based Middleware
```typescript
// Add to filesRouter routes
filesRouter.post("/upload", requireAuth, requireRoles(["analyst", "admin"]), uploadHandler);
filesRouter.get("/upload/preview", requireAuth, requireRoles(["read-only", "reviewer", "analyst", "admin"]), previewHandler);
filesRouter.delete("/:fileId", requireAuth, requireRoles(["admin"]), deleteHandler); // MISSING
```

### 3.2 Missing File Endpoints
- `DELETE /files/:fileId` - Delete uploaded file
- `GET /files` - List all files for tenant
- `POST /files/:fileId/share` - Share file with other users (with permission levels)

---

## 4. Tenant Isolation Enforcement (VERY CRITICAL)

**Current State:** `assertTenantAccess` helper exists but is NOT called in all required locations.

**Required Implementation:**

### 4.1 Add Tenant Checks To:
- [ ] `getAuditLog()` - Already filters by tenant but doesn't assert
- [ ] `listWorkflowTransitions()` - Already filters but doesn't assert
- [ ] `listOrchestratorEvents()` - Already filters but doesn't assert
- [ ] `getUploadedSheet()` - Uses tenantId but no explicit assertion
- [ ] All `/api/spreadsheet/*` routes - Add session tenant validation

### 4.2 Cross-Tenant Test Suite
Create integration tests that verify:
- User from tenant A cannot read tenant B's audit logs
- User from tenant A cannot approve tenant B's pending operations
- User from tenant A cannot access tenant B's uploaded files

---

## 5. Policy Engine Upgrades (HIGH)

**Current State:** Policy engine has in-memory fallback and static high-risk intent list.

**Required Implementation:**

### 5.1 Dynamic Risk Scoring
Replace static `HIGH_RISK_INTENTS` set with:
```typescript
interface PolicyRule {
  intent: string;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  allowedRoles: UserRole[];
  maxAmount?: number; // For monetary limits
  conditions: string[]; // Additional conditions (e.g., "member_approval_required")
}
```

### 5.2 Policy CRUD Endpoints
- `POST /api/admin/policies` - Create new policy version
- `GET /api/admin/policies/:regulator` - Get policy history
- `POST /api/admin/policies/:id/activate` - Activate a policy version
- `GET /api/policies/active` - Get currently active policies

---

## 6. Retention & Archival System (HIGH)

**Current State:** `cleanup-retention.ts` script exists but is not scheduled.

**Required Implementation:**

### 6.1 Scheduled Cleanup Job
```bash
# Add to cron or Windows Task Scheduler
pnpm cleanup:retention
```

### 6.2 Cold Storage Archival
Before deletion:
1. Export audit logs older than 1 year to S3/GCS
2. Export workflow transitions to compressed archive
3. Generate retention compliance report

### 6.3 Missing Retention Rules
| Data Type | Current | Required |
|-----------|---------|----------|
| Audit logs | 365 days | 7 years (CBK requirement) |
| Telemetry | 90 days | 90 days (OK) |
| Idempotency keys | 24 hours | 24 hours (OK) |
| Pending operations (rejected) | No rule | Delete after 30 days |

---

## 7. Observability Gaps (MEDIUM)

**Current State:** Orchestrator telemetry exists but no dashboards or alerts.

**Required Implementation:**

### 7.1 Metrics Endpoints
- `GET /api/admin/metrics/intent-confidence` - Distribution of intent confidence scores
- `GET /api/admin/metrics/pipeline-failures` - Failure rate by stage
- `GET /api/admin/metrics/approval-latency` - Time from pending to approval

### 7.2 Alert Triggers
| Metric | Threshold | Action |
|--------|-----------|--------|
| Intent confidence < 0.6 | > 30% of requests | Trigger prompt retraining |
| Pipeline failure rate | > 5% | Page on-call |
| Approval latency | > 4 hours | Notify reviewers |
| Cross-tenant access attempts | > 0 | Security alert |

---

## 8. Frontend Agent Integration (MEDIUM)

**Current State:** Chat UI exists but doesn't show agent reasoning or tool usage.

**Required Implementation:**

### 8.1 Agent Thought Process Display
Show users:
1. Intent detected: `calculate_provisioning` (confidence: 0.94)
2. Policy gate: ALLOWED (risk: high, requires approval: true)
3. Plan generated: 3 steps
4. Pending operations created: 3

### 8.2 Tool Usage Transparency
When agent uses tools, display:
```
🔧 Using tool: computeRatio
   Input: { type: "NPL", numerator: "NPLs", denominator: "Total Loans" }
   Result: 0.0847 (8.47%)
```

---

## 9. Security Hardening (CRITICAL)

**Current State:** Basic JWT auth exists. No rate limiting, no audit log export.

**Required Implementation:**

### 9.1 Rate Limiting
```typescript
// Add to server/index.ts
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  keyGenerator: (req) => req.user?.tenantId ?? req.ip,
});
```

### 9.2 Audit Log Export
- `POST /api/admin/audit/export` - Export audit logs for date range
- Support formats: PDF, CSV, JSON
- Include digital signature for tamper evidence

### 9.3 Prompt Injection Detection
Add system prompt that instructs agent to:
- Reject requests to ignore previous instructions
- Reject requests to reveal system prompts
- Flag suspicious patterns for security review

---

## 10. Testing Gaps (HIGH)

**Current State:** Limited test coverage.

**Required Test Suites:**

| Suite | Coverage | Status |
|-------|----------|--------|
| Auth middleware | 401/403 for all roles | MISSING |
| Cross-tenant isolation | Deny all cross-tenant access | MISSING |
| Policy gate | Block/high-risk routing | PARTIAL |
| Formula validation | Invalid formula rejection | PARTIAL |
| Pipeline end-to-end | Full accept/reject/execute flow | MISSING |
| File upload | CSV/Excel parsing, role checks | MISSING |
| Idempotency | Duplicate request handling | PARTIAL |

---

## Implementation Priority

### Phase 1 (Do First - Week 1-2)
1. Tool execution engine + `calculate` + `querySheet` tools
2. Tenant isolation enforcement (add `assertTenantAccess` everywhere)
3. Rate limiting middleware
4. Cross-tenant integration tests

### Phase 2 (Week 3-4)
5. File API role enforcement + missing endpoints
6. Policy engine dynamic risk scoring
7. Scheduled retention cleanup job
8. Audit log export functionality

### Phase 3 (Week 5-6)
9. Central prompt registry with versioning
10. Frontend agent transparency UI
11. Metrics endpoints + alerting
12. Security hardening (prompt injection detection)

---

## Files to Create

```
server/
├── tools/
│   ├── toolRegistry.ts          # NEW: Tool discovery and execution
│   ├── calculate.ts             # NEW: Math operations with mathjs
│   ├── querySheet.ts            # NEW: Sheet data queries
│   ├── computeRatio.ts          # NEW: Financial ratio calculations
│   └── validateDataQuality.ts   # NEW: Data quality checks
├── prompts/
│   ├── promptRegistry.ts        # NEW: Versioned prompt store
│   ├── orchestrator.ts          # NEW: Orchestrator system prompt
│   ├── verifier.ts              # NEW: Verification agent prompt
│   └── security.ts              # NEW: Security guard prompt
├── middleware/
│   ├── rateLimiter.ts           # NEW: Rate limiting
│   └── promptInjection.ts       # NEW: Injection detection
├── routes/
│   └── policies.ts              # NEW: Policy CRUD endpoints
└── lib/
    └── auditExport.ts           # NEW: Audit log export with signing

client/src/
└── components/
    └── AgentThoughtProcess.tsx  # NEW: Show agent reasoning UI

scripts/
└── schedule-cleanup.js          # NEW: Cron job wrapper
```

---

## Summary

You have a solid foundation with:
- Correct AI planning + human approval architecture
- Multi-tenant data isolation (partially implemented)
- Policy-driven regulatory system
- Model router with failover
- Complete audit trail infrastructure

**But missing:**
- Dynamic tool execution framework
- Comprehensive system prompt registry
- Full tenant isolation enforcement
- Production security hardening
- Complete test coverage

**This is 60-80% to production-ready.** The gaps are well-defined and implementable.
