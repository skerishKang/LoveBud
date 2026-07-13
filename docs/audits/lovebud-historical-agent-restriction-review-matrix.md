# LoveBud Historical Agent-Restriction Review Matrix

- **Issue:** #3445 (parent governance #3442; canonical owner approval: #3442 comment `4947327550`)
- **Base SHA:** `b631ab383df81c867433486a827a835d439fd684`
- **Canonical governance:** `docs/ops/MVP_AGENT_GOVERNANCE.md`
- **Companion data:** `docs/audits/lovebud-historical-agent-restriction-inventory.json`

## Purpose

Classify remaining historical / task-specific / incident-specific / closed-PR agent
restrictions in `origin/main` and separate documents that still look like current
agent-governance authority (and conflict with `MVP_AGENT_GOVERNANCE.md`) from
documents that are legitimately context-specific, already aligned, or out of the
minimal first-tranche scope.

This audit does **not** bulk-modify repository history. Only a minimal first
tranche is corrected (Stage B); the rest is deferred.

## Survey method

Grep lexicon (EN + KO): `BLOCKED`, `STOP`, `must not`, `do not`, `never`,
`prohibited`, `forbidden`, `approval required`, `CTO approval`, `owner approval`,
`fixed slot`, `assigned URL`, `entrypoint comment`, `dirty worktree`,
`one task per branch`, `draft by default`, `production URL`, `browser start`,
`browser navigation`, `login`, `merge approval`, `금지`, `중단`, `승인 필요`,
`명시 승인`, `작업 중단`.

Each hit was read at bounded heading/paragraph level and judged against
`MVP_AGENT_GOVERNANCE.md`. Grep hits in product/Scout contracts, refactor
stage docs, security runbooks, QA matrices, and reports were reviewed for
false positives (product copy, user-facing text, legitimate named-context CTO
approvals, security implementations) and excluded from the agent-governance
inventory where they are not repo-wide automatic-blocker claims.

All root and subdirectory `README.md` files (16 found) were additionally
scanned with the same restriction lexicon. README CTO-approval gates
(`functions/README.md`, `modal_compute/README.md`, `netlify/README.md`,
`netlify/functions/README.md`, `netlify/sql/README.md`) are all API/runtime/
backend/DB scoped and excluded per Section 6; CSS-archive and secret-handling
READMEs contain no agent-governance process restriction. README scan completed
with no additional qualifying agent-governance item.

**Out of scope per task Section 6:** PR #3432, branch
`db/tree-comments-zero-secondary-reconcile-3431`, tree comments migration,
Scout, moment Social, runtime JS, Cloudflare Functions, Modal, API, UI/CSS,
`css/editor.css`, DB/SQL, workflow, deployment config, secret/env, `SKILL.md`.

## Totals

- **Total inventory items:** 19
- **NOW (first tranche):** 6
- **DEFER:** 13

### Classification counts

| Classification | Count |
| --- | --- |
| OVER_RESTRICTIVE_MVP_BLOCKER | 6 |
| DUPLICATE_OR_CONFLICTING | 2 |
| CONTEXT_SPECIFIC_GUARDRAIL | 9 |
| USER_APPROVED_STANDING_RULE | 1 |
| HARD_SECURITY_OR_DATA_SAFETY | 1 |
| RECOMMENDATION_ONLY | 0 |
| STALE_OR_SUPERSEDED | 0 |

### Tranche counts

| Tranche | Count | Paths |
| --- | --- | --- |
| NOW | 6 | `docs/ops/ops_index.md`, `docs/doc_index.md`, `docs/ops/EDITOR_DETAIL_UI_BROWSER_SMOKE_CHECKLIST.md`, `docs/ops/ACTIVE_WORK_BOARD_POLICY.md`, `docs/ops/GITHUB_AUTH_TOKEN_USAGE.md`, `docs/ops/CLOUDFLARE_PREVIEW_PROVENANCE_RUNBOOK.md` |
| DEFER | 13 | `docs/ops/TEST_PREVIEW_SLOTS.md`, `docs/ops/VERIFICATION_TARGET_ALLOWLIST.md`, `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md`, `docs/ops/BROWSER_VERIFICATION_SLOT_GATE.md`, `docs/ops/LOCAL_BROWSER_VERIFICATION_STARTUP.md`, `docs/ops/AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`, `docs/ops/BROWSER_VERIFICATION_URL_POLICY.md`, `docs/ops/FIXED_SLOT_MANUAL_E2E_GATE.md`, `docs/ops/WORK_RISK_TIER_POLICY.md`, `docs/project/AGENT_OPERATION_GUARDRAILS.md`, `docs/ops/AGENT_STARTUP_VERIFICATION_RULES.md`, `docs/security/FIREBASE_API_KEY_RESTRICTION_RUNBOOK.md`, `docs/product/PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md` |

## NOW tranche (corrected in this PR)

All six are reachable from `docs/ops/ops_index.md` / `docs/doc_index.md`
read-first lists and contain an active-looking restriction that classifies an
MVP-de-escalated item as an automatic blocker/approval/stop gate.

| Path | Conflict with MVP | Disposition |
| --- | --- | --- |
| `docs/ops/EDITOR_DETAIL_UI_BROWSER_SMOKE_CHECKLIST.md` | Missing fixed slot → `BLOCKED_SLOT_DECISION_MISSING` (L148) | `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` (within Issue #521) |
| `docs/ops/ACTIVE_WORK_BOARD_POLICY.md` | Dirty worktree → `STOP` (L87); slot SHA unconfirmed → `PASS forbidden` (L81) | `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` (within Issue #426) |
| `docs/ops/GITHUB_AUTH_TOKEN_USAGE.md` | Routine merge requires explicit CTO approval (L202, L283) | `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` for merge-approval language; secret-handling preserved |
| `docs/ops/CLOUDFLARE_PREVIEW_PROVENANCE_RUNBOOK.md` | Production/localhost banned as pre-merge proof (L34/L212); fixed slot only if CTO assigns (L90) | `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` for conflicting gate language; provenance/SHA reporting preserved |
| `docs/ops/ops_index.md` | Read-first routes to conflicting docs without canonical authority pointer | Add canonical-governance note |
| `docs/doc_index.md` | Same as above | Add canonical-governance note |

## DEFER rationale (representative)

- **Already aligned by #3444** (covered by `mvp-agent-governance-contract.test.cjs`):
  `BROWSER_VERIFICATION_SLOT_GATE.md`, `LOCAL_BROWSER_VERIFICATION_STARTUP.md`,
  `AGENTS_BROWSER_VERIFICATION_ENTRYPOINT.md`, `BROWSER_VERIFICATION_URL_POLICY.md`,
  `FIXED_SLOT_MANUAL_E2E_GATE.md`, `AGENT_OPERATION_GUARDRAILS.md`,
  `AGENT_STARTUP_VERIFICATION_RULES.md`, `WORK_RISK_TIER_POLICY.md`. No change.
- **Deeper follow-up than minimal first tranche** (reachable only via secondary
  references, partially conflicting): `TEST_PREVIEW_SLOTS.md`,
  `VERIFICATION_TARGET_ALLOWLIST.md`, `UI_SCREENSHOT_CTO_REVIEW_POLICY.md`.
- **Legitimate context-specific / security scope** (supported by canonical hard
  rule #3442 comment `4947327550`; not a general over-restriction, and a
  restriction appearing in the doc is **not** itself approval evidence):
  `FIREBASE_API_KEY_RESTRICTION_RUNBOOK.md`,
  `PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md`.

## Disposition rules applied

- `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT`: the document's stricter agent-blocker
  interpretation is retained only within its named original issue scope and is
  not repo-wide automatic-blocker authority.
- `SUPERSEDED_BY_MVP_AGENT_GOVERNANCE`: not used wholesale; no whole-file
  supersession was needed because each corrected file retains valid
  tool-usage / security / verification-depth content.
- **Preserved:** secret-handling (HARD_SECURITY), destructive-production
  approval protection, SHA-provenance reporting, parallel-work coordination.
- **Not weakened:** security/destructive-production hard rules.

## Follow-up disposition applied by #3448

Issue #3448 de-escalated the fixed-slot and verification-target automatic
blocker language that was deferred from the first tranche (DEFER, not NOW).

- Target docs: `docs/ops/TEST_PREVIEW_SLOTS.md`, `docs/ops/VERIFICATION_TARGET_ALLOWLIST.md`.
- These two entries were `tranche: DEFER` in the #3445 snapshot and **remain
  DEFER**; #3448 is a follow-up applied to the deferred entries, not a tranche
  reclassification.
- Automatic blocker removal: fixed-slot absence, CTO-assigned URL absence, and
  provenance/SHA uncertainty no longer produce a project-wide `BLOCKED`; they
  lower the claim status (`FIXED_SLOT_NOT_ASSIGNED`, `NOT_VERIFIED_ON_FIXED_SLOT`,
  `PARTIAL`, `NOT_VERIFIED`, `INVALID_FOR_TARGET_CLAIM`).
- Evidence-quality guidance preserved: SHA-provenance reporting, Netlify/
  lovebudold invalid for current Cloudflare + Modal runtime proof, secret/token/
  cookie/private payload protection, production write/delete approval protection,
  main direct push/force-push protection.
- Canonical blocker authority is `docs/ops/MVP_AGENT_GOVERNANCE.md`; the
  self-precedence clause in `VERIFICATION_TARGET_ALLOWLIST.md` was removed and
  the `Ready transition: NO` / `Merge: NO` / `Issue close: NO` automatic results
  were removed (merge is governed only by canonical hard rules).
- Inventory follow-up metadata added to both target entries:
  `followup_issue: 3448`, `followup_status: "APPLIED"`,
  `followup_disposition: "PRESERVE_AS_EVIDENCE_QUALITY_GUIDANCE"`.

## Validation

- Inventory JSON parses and carries required fields (see contract
  `tests/contracts/historical-agent-guidance-disposition-contract.test.cjs`).
- Corrected docs carry the disposition marker + canonical link.
- Corrected docs do not re-introduce unconditional blockers for dirty worktree,
  fixed-slot absence, PR entrypoint absence, draft, one-task-per-branch,
  browser start/navigation/login, or routine merge.
- Security/destructive-production hard rules retained.

Refs #3445
Refs #3442
Refs #3441
Refs #3437
Refs #3435
Refs #1882
