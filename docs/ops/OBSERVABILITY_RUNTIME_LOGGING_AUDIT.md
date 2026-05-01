# Observability and Runtime Logging Strategy Audit

**Status**: Completed planning/audit  
**Owner**: CTO / Ops Lead  
**Scope**: docs-only audit and strategy planning  
**Related**: Issue #415, Issue #470 (implementation follow-up A)

---

## 1. Purpose

This document provides a comprehensive audit of LoveBud's current observability and runtime logging landscape, identifying gaps in cross-layer debugging and establishing a safe, redaction-aware strategy for future implementation.

The goal is not to implement broad logging, analytics, or telemetry collection. The goal is to create a **planning foundation** that enables safe, minimal runtime diagnostics without exposing sensitive values.

---

## 2. Current Observability Sources Inventory

### 2.1 Cloudflare Pages Functions

**Current state**: Active runtime entry point

**Observable data**:
- HTTP request/response metadata (method, path, status, duration)
- Deployment status and build logs
- Function invocation logs (limited, no sensitive payload logging)

**Limitations**:
- No structured request correlation across Modal boundary
- No persistent request ID propagation
- Limited error classification granularity

### 2.2 Modal Backend

**Current state**: Active compute layer for browse, read/write operations

**Observable data**:
- Application logs (stderr/stdout)
- Function invocation metadata
- Error stack traces (may include sensitive context)

**Limitations**:
- No standardized request ID correlation with browser/Cloudflare
- Logging patterns vary by route
- No explicit redaction policy documented

### 2.3 Browser Runtime / Console

**Current state**: User-facing frontend (lovebud.pages.dev)

**Observable data**:
- Console errors and warnings
- Network request metadata (visible in DevTools)
- JavaScript runtime exceptions

**Limitations**:
- No request ID surfaced for correlation
- Error reports rely on user description
- No structured diagnostic collection

### 2.4 GitHub CI / Checks

**Current state**: Static verification and deployment gates

**Observable data**:
- verify-static results
- Cloudflare Pages deployment status
- GitGuardian security scans

**Value**: Pre-deployment validation, no runtime observability

### 2.5 Cloudflare Pages Deployment / Check Status

**Current state**: Per-deployment health checks

**Observable data**:
- Build success/failure
- Deployment URL
- Preview URL generation

**Value**: Deployment verification, not runtime debugging

---

## 3. Runtime Request Path Map

```
browser (lovebud.pages.dev)
    ↓
same-origin /api/* (Cloudflare Pages Functions)
    ↓
Cloudflare Pages Functions proxy/routing
    ↓
Modal backend (modal.com)
    ↓
Neon PostgreSQL
```

### 3.1 Current Debugging Gaps by Layer

**Browser request construction**
- No request ID generated at origin
- Limited visibility into request payload construction
- Auth header attachment not observable (and should not be logged)

**Auth / session state**
- Firebase Auth token validation happens in Modal
- Token expiry/refresh not correlated across layers
- 401/403 classification relies on Modal logs (may expose sensitive context)

**Cloudflare Pages Functions proxy behavior**
- Proxy logic visible in functions/api/[[path]].js
- Request forwarding to Modal not instrumented
- No correlation ID added during proxy phase

**Modal upstream response**
- Response construction varies by route
- Error handling not standardized
- Database query failures not classified safely

**Neon / database access**
- Query execution time not surfaced safely
- Connection pool status not visible
- Query patterns should never be logged with parameters

**Timeout / malformed response / 401 / 403 / 5xx**
- No unified classification across layers
- Browser sees 401 but cannot distinguish:
  - Missing token
  - Expired token
  - Invalid token
  - Route-level auth failure
- 5xx errors not correlated with Modal backend state

---

## 4. Sensitive Data Redaction Policy

### 4.1 Values That Must Never Be Logged or Exposed

**Authentication & Authorization**:
- `Authorization` headers (all schemes: Bearer, Basic, etc.)
- Firebase Auth tokens (ID tokens, custom tokens)
- Session cookies or session identifiers
- Refresh tokens
- API keys (Cloudflare, Modal, Firebase, Neon, any third-party)

**Firebase & Service Accounts**:
- Firebase service account credentials
- `firebase-adminsdk` private keys
- Firebase project configuration secrets
- Google OAuth client secrets

**Request Payloads**:
- Raw private request bodies containing tree/memory content
- User-generated content (titles, descriptions, notes)
- Private metadata associated with trees or moments

**User Identity**:
- Firebase UIDs in isolation (OK in correlation contexts only)
- Email addresses
- OAuth callback parameters containing session material
- Private profile information

### 4.2 Redaction Policy in Practice

**When logging is necessary, use**:
- Status categories: `AUTH_FAILED`, `VALIDATION_FAILED`, `UPSTREAM_TIMEOUT`, `DB_ERROR`, `NOT_FOUND`, `UNEXPECTED_ERROR`
- Redacted field markers: `[REDACTED]`, `[PRESENT]`, `[ABSENT]`
- Never raw values

**Example of forbidden logging**:
```javascript
// FORBIDDEN - exposes sensitive values
console.log(`User ${uid} failed auth with token ${token}`);
console.log(`Request body: ${JSON.stringify(body)}`);
console.log(`Authorization: ${headers.authorization}`);
```

**Example of allowed logging**:
```javascript
// Allowed - uses safe categories only
console.log(`Request: ${requestId}, Route: ${route}, Status: 401, Category: AUTH_FAILED`);
```

---

## 5. Safe Diagnostic Fields

### 5.1 Fields Allowed in Redaction-Safe Diagnostics

| Field | Example | Sensitivity |
|-------|---------|-------------|
| Generated request ID | `req-abc123def456` | Non-sensitive |
| Route pattern | `/api/trees/browse` | Non-sensitive |
| HTTP method | `GET`, `POST` | Non-sensitive |
| Status code | `200`, `401`, `500` | Non-sensitive |
| Coarse error category | `AUTH_FAILED`, `TIMEOUT` | Non-sensitive |
| Duration bucket | `<100ms`, `100-500ms`, `>1s` | Non-sensitive |
| Deployment label | `production`, `preview` | Non-sensitive |
| Timestamp | `2026-05-01T09:30:00Z` | Non-sensitive |
| Environment | `cloudflare-pages`, `modal` | Non-sensitive |

### 5.2 Fields Never Allowed

| Field | Reason |
|-------|--------|
| Authorization header | Credential exposure |
| Cookie values | Session hijacking risk |
| Firebase token | Credential exposure |
| Raw request body | Private content exposure |
| Tree/memory content | User privacy violation |
| User email | PII exposure |
| Query parameters with tokens | Credential leakage |
| Stack traces with variable values | May embed sensitive data |

---

## 6. Follow-up Implementation Issue Plan

### 6.1 Issue A — Redaction-Safe Request Correlation

**Created**: Issue #470  
**Title**: Implement redaction-safe request correlation across browser, Cloudflare, and Modal

**Scope**:
- Generate or accept non-sensitive request ID at browser or Cloudflare boundary
- Forward request ID from Cloudflare Pages Functions to Modal
- Include request ID in redaction-safe diagnostics
- Ensure request ID values do not encode sensitive data

**Non-goals**:
- No third-party error tracking vendor
- No analytics/tracking script
- No raw request body logging
- No structured logging expansion (covered in Issue B)

**Candidate files**:
- `functions/api/[[path]].js` — request ID forwarding
- Browser API client — request ID generation (if client-side)
- `modal_compute/app.py` — request ID reception
- Modal helper modules — logging integration

---

### 6.2 Issue B — Modal Structured Logging

**Planned**: To be created after Issue A

**Title**: Implement redaction-safe Modal structured logging using request IDs

**Scope**:
- Define minimal structured logging pattern in Modal
- Use request ID from Issue A for correlation
- Classify errors without exposing sensitive data
- Document allowed/forbidden log fields

**Non-goals**:
- No broad Modal route rewrite
- No DB schema change
- No third-party logging vendor
- No request ID implementation (covered in Issue A)

**Candidate files**:
- `modal_compute/app.py` — main application logging
- `modal_compute/auth.py` — auth error classification (coarse only)
- `modal_compute/db.py` — DB error classification (coarse only)
- `modal_compute/validation.py` — validation error classification

---

### 6.3 Issue C — Runtime Diagnostics Runbook

**Planned**: To be created after Issue B

**Title**: Document Cloudflare and Modal runtime diagnostics workflow

**Scope**:
- Create operator-facing runbook for runtime failure diagnosis
- Document browser observation checklist
- Define Cloudflare Pages deployment/check status review steps
- Define Modal backend diagnostics procedure
- Define error classification (401, 403, 5xx, timeout, malformed)
- Define fixed test slot requirements for Auth/API flows
- Define secret-safe report templates

**Non-goals**:
- No runtime logging implementation
- No request ID implementation
- No Modal logging implementation
- No analytics/tracking

**Candidate files**:
- `docs/ops/` — new or updated runbook
- `docs/ops/ops_index.md` — index link if needed

---

### 6.4 Optional Later Work

**Browser-facing request ID / error reporting policy**:
- Decide whether non-sensitive request IDs should surface to users
- Define admin-facing error report format
- Avoid exposing internal stack traces

**Third-party error tracking evaluation**:
- Only if operational pain justifies vendor adoption
- Requires separate security and privacy review
- Must comply with redaction policy

---

## 7. Explicit Non-Goals of This Audit

This audit document **does not authorize**:

- ❌ Runtime logging changes
- ❌ Telemetry collection changes
- ❌ Analytics or tracking scripts
- ❌ Third-party error tracking vendor adoption
- ❌ Request ID/header implementation
- ❌ Cloudflare route behavior changes
- ❌ Modal API behavior changes
- ❌ Package dependency additions
- ❌ GitHub Actions workflow changes
- ❌ Secret inspection or output

This audit is **planning-only**. All implementation work is tracked in separate follow-up issues.

---

## 8. Issue Disposition

### 8.1 #415 Scope Completion

This document completes the **audit and planning scope** of Issue #415:

✅ Current observability source inventory  
✅ Browser → Cloudflare → Modal → Neon runtime path map  
✅ Debugging gap classification by layer  
✅ Sensitive data redaction policy  
✅ Safe diagnostic field model  
✅ Follow-up implementation issue split (A, B, C)

### 8.2 Implementation Work Separation

All implementation work is intentionally split into follow-up issues:

- **Issue #470** (A): Redaction-safe request correlation
- **Issue B** (planned): Modal structured logging  
- **Issue C** (planned): Runtime diagnostics runbook

### 8.3 Closure Recommendation

Issue #415 can be considered **complete as a planning/audit issue** once:

1. ✅ This audit document is merged
2. ✅ Issue A (#470) is created
3. ⏳ Issue B is created
4. ⏳ Issue C is created
5. ⏳ CTO confirms implementation tracking has moved to follow-up issues

**Do not close #415 until all follow-up issues are created and CTO approves closure.**

---

## 9. Verification Requirements for Follow-up Issues

### 9.1 Static Verification (All Issues)

- [ ] No secret/token/session/cookie values printed
- [ ] No raw private payload logging
- [ ] No package/workflow changes unless explicitly approved
- [ ] Changed files limited to approved implementation scope

### 9.2 Runtime Verification (Issue A & B)

- [ ] Browser → Cloudflare → Modal request still succeeds
- [ ] Request ID is generated and propagated
- [ ] Error path can be correlated without sensitive data
- [ ] Auth/API behavior is unchanged
- [ ] No 401 loop or new runtime failure

### 9.3 Environment Requirements

- **Fixed test slot required** for Auth/API/runtime verification if browser flow is involved
- **PR preview alone is not sufficient** for final PASS if login/Auth/API state is required
- Modal logs must be reviewed in a **secret-safe way**, reporting only field names/categories

---

## 10. Guardrails for All Follow-up Work

- Do not modify PR #7 or prototype/reference/demo/variant paths
- Do not touch active unrelated PRs (#468, #450, #462, #463, etc.)
- Do not combine with UI work
- Do not combine with Modal repository/query split work unless explicitly scoped
- Do not combine with Cloudflare Analytics or third-party error tracking
- Do not expose sensitive values in issue comments, PRs, logs, screenshots, or reports

---

## 11. Acceptance Criteria Summary

### 11.1 For This Audit (Issue #415)

- [x] Current logging/analytics sources are inventoried
- [x] Observability gaps are linked to real debugging needs
- [x] Sensitive data redaction rules are documented
- [x] Implementation follow-up has explicit allowed/forbidden files and validation requirements

### 11.2 For Issue A (Request Correlation)

- [ ] Non-sensitive request ID generated and propagated
- [ ] Request ID appears in diagnostics without encoding sensitive data
- [ ] Existing API behavior unchanged
- [ ] No secrets/cookies/tokens/sessions logged

### 11.3 For Issue B (Modal Structured Logging)

- [ ] Minimal redaction-safe logging pattern defined
- [ ] Logs include request ID when available
- [ ] Error classification uses coarse categories only
- [ ] No private payload or sensitive header logging

### 11.4 For Issue C (Diagnostics Runbook)

- [ ] Operator-facing runtime diagnostics workflow documented
- [ ] Fixed test slot requirements specified
- [ ] Secret-safe report templates provided
- [ ] No runtime implementation changes included

---

## 12. Related Documents

- [Issue #415](https://github.com/skerishKang/LoveBud/issues/415) — Original planning/audit request
- [Issue #470](https://github.com/skerishKang/LoveBud/issues/470) — Implementation follow-up A (request correlation)
- `docs/ops/ops_index.md` — Operations documentation index
- `docs/ops/TEST_PREVIEW_SLOTS.md` — Fixed test slot requirements
- `docs/ops/AGENTS.md` — Agent secret handling policy

---

**Document version**: 1.0  
**Last updated**: 2026-05-01  
**Next review**: When Issue A, B, or C implementation begins
