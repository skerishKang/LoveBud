# Primary RGBA Token Usage Audit

> **Status:** NEEDS_FOLLOWUP  
> **Source:** Issue #224 item 2  
> **Type:** Docs-only — no CSS changes in this document

---

## 1. Purpose

This document captures the hard-coded `primary` RGBA usage audit result from Issue #224 item 2.

The audit identified all occurrences of hard-coded primary RGBA values across the codebase and classified each file-level hit by risk level and replacement readiness. CSS token replacement implementation is **not** part of this document; it is tracked separately under Issue #224 and any follow-up PRs.

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #224 item 2 |
| Prior status | `NEEDS_FOLLOWUP` |
| Audit scope | All CSS, JS, and HTML files in the active codebase |

---

## 3. Reported Totals

| Category | Count |
|---|---|
| Safe replacement candidates | 10 |
| Hold / visual risk | 19 |
| Excluded | 4 |
| Already tokenized | 0 |
| **Total file-level hits** | **33** |

---

## 4. High-Risk / Hold Areas

These areas carry visual or behavioral coupling risk and must **not** be touched in a broad cleanup pass.

| Area | Reason for Hold |
|---|---|
| **Search** — tree cards, preview, skeleton states | Visual states tightly coupled to runtime JS; safe-to-replace threshold is unclear without per-rule smoke testing |
| **Editor** — canvas and runtime JS/CSS-adjacent UI behavior | Canvas and runtime-driven colors may have side-effects if CSS tokens are swapped without matching JS updates |
| **Detail** — public detail view | Detail view layout and color behavior have not been audited for cascading effects |
| **Intro** — hero visual treatment | Hero accent treatment was intentionally designed; any replacement needs design review |

---

## 5. First Cleanup Candidates

These files are the lowest-coupling targets and are safe to attempt token replacement in a dedicated follow-up PR, subject to visual smoke testing.

1. `css/global.css`
2. `css/global/header.css`
3. Selected editor sidebar/form CSS — **only if confirmed low-coupling** after per-file review

> **Note:** Cleanup PRs for the above files must remain CSS-only and must be visually smoke-tested before merge.

---

## 6. Guardrails

The following constraints apply to any implementation work that follows from this audit:

- **No broad global search/replace.** Each replacement must be evaluated per rule and per file.
- **No prototype/reference/demo/variant file changes.** These files are excluded from the audit scope and must not be touched.
- **No combined Search/Editor/Detail/Intro cleanup** in a single PR. High-risk areas must be handled in separate, independently reviewed PRs.
- **No UI redesign.** Token replacement must preserve existing visual output; this is a like-for-like substitution exercise.
- **Implementation must be CSS-only.** No JS changes to achieve color replacement.
- **Visual smoke testing is mandatory** for every replacement before merge.

---

## 7. Recommended Next Sequence

| Step | Action | Notes |
|---|---|---|
| 1 | **Docs-only audit capture** (this PR) | Establish shared record of audit state before any implementation |
| 2 | **Global/header low-coupling CSS-only cleanup** | `css/global.css` and `css/global/header.css` only; CSS-only, smoke-tested |
| 3 | **Page-specific visual-risk PRs** | Each high-risk area (Search, Editor, Detail, Intro) in a dedicated PR, after design/engineering review |

---

## 8. Verification Checklist

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/design/PRIMARY_RGBA_TOKEN_USAGE_AUDIT.md`
- [ ] No CSS/JS/page/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #224 in this document

---

## Notes

Issue #224 remains **open**. The other technical-debt checklist items and any implementation follow-ups remain pending and will be tracked under Issue #224 or linked follow-up issues.
