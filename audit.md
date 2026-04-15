# Audit and Compliance Design

This document defines the audit model required for a production-grade financial AI IDE.

## 1) Audit Objectives

- Prove who did what, when, why, and with which policy/model context.
- Reconstruct full decision flow for regulator and internal audits.
- Detect unauthorized, high-risk, or anomalous actions quickly.

## 2) Audit Event Model

Record immutable events for each stage:

- `request_received`
- `intent_classified`
- `policy_checked`
- `plan_generated`
- `plan_validated`
- `operation_queued`
- `operation_accepted` or `operation_rejected`
- `operation_executed`
- `execution_verified`
- `response_sent`
- `error_emitted`

Required fields per event:

- `event_id` (UUID)
- `correlation_id` (request trace ID)
- `session_id`
- `tenant_id`
- `user_id`
- `role`
- `timestamp_utc`
- `event_type`
- `status`
- `reason_code` (if non-success)
- `regulator`
- `model_provider`, `model_name`, `route_id`
- `prompt_version`, `policy_version`, `schema_version`
- `input_hash`, `output_hash`
- `metadata` (small JSON object)

## 3) Integrity and Immutability

- Audit events are append-only.
- No update/delete for finalized audit rows.
- Use hash chaining or signed checkpoints for tamper evidence.
- Keep write path independent from normal operational mutation path where possible.

## 4) Review and Approval Audit

For maker-checker workflows, capture:

- maker identity and submission context
- checker identity and decision (`accept`/`reject`)
- approval timestamp
- decision rationale
- before/after values for mutated cells/ranges

This is mandatory for provisioning and report-impacting operations.

## 5) Data Retention and Export

Recommended minimum retention:

- operational audit logs: 7 years (institution policy may require longer)
- model routing and policy decision logs: 2 to 7 years depending on risk class

Export formats:

- JSON for systems integration
- CSV for operations/legal review
- SQL dump for regulated archival workflows

Every export must include:

- generation timestamp
- generated-by user
- scope filters used
- total records and checksum

## 6) Monitoring and Alerting

Alert on:

- repeated plan validation failures
- elevated reject rates by role/team
- unusual spikes in high-risk operation requests
- missing audit emissions in expected stage sequence
- execution without prior approval event

## 7) Production Controls Checklist

- [ ] Immutable audit table/ledger in durable database
- [ ] Correlation IDs propagated across route, pipeline, engine
- [ ] Signed export artifacts with checksums
- [ ] Role-restricted audit export endpoints
- [ ] Audit log integrity verification job
- [ ] Periodic compliance report generator

## 8) Current Project Mapping

Current code already has baseline audit support:

- `server/engine/auditLogger.ts`
- `server/routes/spreadsheet.ts` (`/audit/:sessionId`)

To become production-ready, extend this to:

- full event taxonomy
- immutable persistence guarantees
- complete model/policy metadata capture
- alerting and evidence automation.
