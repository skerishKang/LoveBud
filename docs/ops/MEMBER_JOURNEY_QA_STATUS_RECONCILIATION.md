# Member Journey QA Status Reconciliation

Refs #838
Refs #839
Refs #840
Refs #841
Refs #842
Refs #843
Refs #844
Refs #846
Refs #849
Refs #851
Refs #861
Refs #863
Refs #871
Refs #873
Refs #877

## Purpose

This document reconciles the current documentation and execution status of the LoveBud member journey QA suite.

The core QA suite and related operating policies already exist in repository docs. The remaining work is not another broad QA-suite document. The remaining work is to keep a clear separation between:

```text
- reusable docs/policy already recorded in the repository;
- browser execution that still needs fixed-slot or production-smoke evidence;
- credential/evidence inventory work that must remain secret-safe;
- future narrow implementation PRs created only when verification finds a defect.
```

## Current source-of-truth documents

| Area | Source document | Status |
| --- | --- | --- |
| Member journey suite | `docs/ops/MEMBER_JOURNEY_QA_SUITE.md` | DOC_PRESENT |
| Personas | `docs/ops/MEMBER_JOURNEY_PERSONAS.md` | DOC_PRESENT |
| Synthetic actor/account strategy | `docs/ops/SYNTHETIC_ACTOR_ACCOUNT_STRATEGY.md` | DOC_PRESENT |
| PR checklist guidance | `docs/ops/PR_CHECKLIST.md` | DOC_PRESENT |
| Credential and local secret handling | `docs/ops/AGENTS.md`, `docs/ops/AGENT_SECURITY.md`, credential-specific docs | DOC_PRESENT |
| Browser verification URL and slot policy | `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`, `docs/ops/BROWSER_VERIFICATION_SLOT_GATE.md`, `docs/ops/CLOUDFLARE_PREVIEW_PROVENANCE_RUNBOOK.md` | DOC_PRESENT |

## Issue reconciliation

### Suite definition issues

| Issue | Scope | Reconciled status | Remaining action |
| --- | --- | --- | --- |
| #838 | Define end-to-end member journey verification suite | DOC_PRESENT / EXECUTION_PENDING | Use the suite for future runtime-sensitive verification; no new broad docs PR needed unless policy changes. |
| #839 | Auth signup/login checklist | DOC_PRESENT / EXECUTION_PENDING | Run fixed-slot Auth journey when assigned; record report on the issue. |
| #840 | First tree creation checklist | DOC_PRESENT / EXECUTION_PENDING | Run fixed-slot first-create journey when assigned; record report on the issue. |
| #841 | Returning user My Trees checklist | DOC_PRESENT / EXECUTION_PENDING | Run fixed-slot returning-user journey when assigned; record report on the issue. |
| #842 | Editor moment editing checklist | DOC_PRESENT / EXECUTION_PENDING | Run fixed-slot Editor journey when assigned; record report on the issue. |
| #843 | Public viewer read-only checklist | DOC_PRESENT / EXECUTION_PENDING | Run public/read-only viewer journey after a target route/deploy is available. |
| #844 | Mobile and error recovery matrix | DOC_PRESENT / EXECUTION_PENDING | Run mobile/error recovery checks as part of target PR or batch verification. |

### Persona and account strategy issues

| Issue | Scope | Reconciled status | Remaining action |
| --- | --- | --- | --- |
| #846 | Member personas | DOC_PRESENT | Select personas in runtime-sensitive verification prompts. |
| #849 | Three-track synthetic actor strategy | DOC_PRESENT / OPS_EXECUTION_PENDING | Keep QA/test, user-behavior, and AI activity separated in reports and credentials. |
| #851 | Initial free password manager account set | DOC_PRESENT / OPS_EXECUTION_PENDING | CTO-managed password manager registration still needs safe status inventory. |
| #861 | Multi-machine QA credential file handoff | DOC_PRESENT / OPS_EXECUTION_PENDING | Local credential files and USB handoff remain execution-only, not repository material. |
| #863 | Verification report to fix/retest lifecycle | DOC_PRESENT | Use issue comments for per-run reports, not repository docs. |

### Evidence and credential inventory issues

| Issue | Scope | Reconciled status | Remaining action |
| --- | --- | --- | --- |
| #871 | Browser screenshot evidence inventory | OPS_EXECUTION_PENDING | Collect safe metadata and classify screenshots as SAFE_TO_UPLOAD / LOCAL_ONLY / DELETE_RECOMMENDED / MISSING. |
| #873 | Register QA/AI accounts in password manager | OPS_EXECUTION_PENDING | Record only safe inventory rows in GitHub; actual credentials remain outside GitHub. |
| #877 | Require screenshot evidence and credential inventory for future batches | DOC_PRESENT / EXECUTION_RULE_ACTIVE | Future browser prompts should include evidence and credential preservation requirements. |

## What should not be duplicated

Do not create another broad replacement for `MEMBER_JOURNEY_QA_SUITE.md` unless the actual operating policy changes.

Do not turn repository docs into an incident log. Per-run results belong in issue comments or PR comments. Docs should hold stable templates and reusable policy only.

Do not store screenshot artifacts, local credential file contents, raw browser logs, request/response payloads, private URLs, IDs, or credentials in repository docs.

## Recommended next work split

### Workstream A — Execution batch planning

Use issue comments or an ops tracker comment to assign:

```text
- target issue or PR
- persona
- journey
- fixed slot or production-smoke target
- expected deployed SHA
- account label and credential key only
- report destination
```

No repository change is required unless the process changes.

### Workstream B — Evidence inventory

For #871 and #877, collect only safe screenshot metadata:

```text
- screenshot filename or artifact label
- local artifact location label
- journey or verification scope
- viewport
- PASS/FAIL context
- SAFE_TO_UPLOAD / LOCAL_ONLY / DELETE_RECOMMENDED / MISSING
```

Do not upload or paste screenshots until they are manually reviewed for secret/private exposure.

### Workstream C — Credential inventory

For #873, record only GitHub-safe metadata:

```text
- Account label
- Track
- Persona or AI role
- Credential key
- Credential location label
- Status
- Secret values exposed: NO
```

Actual credential values must remain in the approved password manager or approved local credential file and must not be committed, pasted, screenshotted, or logged.

### Workstream D — Defect-to-PR lifecycle

Create a new narrow implementation issue or PR only when verification finds a defect.

Use this sequence:

```text
verification report
-> finding classification
-> narrow fix issue if code change is needed
-> implementation PR with Refs only
-> fixed-slot retest
-> final disposition
```

## Completion interpretation

The QA suite documentation layer is present enough for future execution. The open status of the QA issues should be interpreted as execution tracking unless a specific missing policy is identified.

A future issue may be closed or moved forward only after CTO review confirms whether the required documentation and/or execution evidence is sufficient. This document does not close any issue.

## Guardrails

```text
- Use Refs only in PRs and comments unless CTO explicitly approves closure wording.
- Do not push directly to main.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.
- Do not expose actual email, password, token, session, cookie, request header, private UID, tree ID, owner ID, memory ID, copied tree ID, DB row value, raw private URL, raw request/response payload, or credential file contents.
- Do not claim browser PASS from docs-only reconciliation.
```
