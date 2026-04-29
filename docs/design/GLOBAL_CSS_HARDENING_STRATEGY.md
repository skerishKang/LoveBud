# Global CSS Hardening Strategy

> **Status:** STRATEGY_ONLY  
> **Source:** Issue #137  
> **Type:** Docs-only — no CSS implementation in this PR

---

## 1. Purpose

This document records the global CSS hardening strategy before implementation.

The goal is to reduce risk around `css/global.css` and related shared styling surfaces by documenting known findings, phased implementation order, guardrails, and required verification before any CSS changes are made.

This strategy intentionally does **not** implement CSS changes. It is a planning baseline for later small, scoped PRs.

---

## 2. Current Known Findings

The following findings are known from the current Issue #137 cleanup backlog and related audits:

- `:root` appears in multiple blocks.
- PR3/control tokens exist in a later root block.
- Material Symbols loading state is split between `.ms-fonts-loaded` and `html.material-symbols-ready`.
- The global `.material-symbols-outlined` hiding rule has broad impact.
- `transition: none` appears in nav, auth, and icon-loading areas.

These are shared styling concerns and should not be addressed through a broad `global.css` rewrite.

---

## 3. Completed Related Work

The following related cleanup and documentation work is already complete or treated as current baseline context:

- PR #155: foundational global CSS split.
- PR #285: My Trees inline display cleanup.
- PR #293: editor overrides formatting cleanup.
- `pages/editor.html` inline `onmousedown` item is current-main no-op.

These completed items reduce surrounding cleanup pressure, but they do not complete the remaining `css/global.css` hardening work.

---

## 4. Recommended Implementation Phases

### Phase 1: Token/root inventory only

Inventory all `:root` blocks and token declarations before moving or replacing anything.

Deliverable:
- Audit-only document or small test/report.
- No CSS changes.

### Phase 2: Material Symbols ready-class strategy

Clarify the intended relationship between `.ms-fonts-loaded`, `html.material-symbols-ready`, and the broad `.material-symbols-outlined` hiding rule.

Deliverable:
- Strategy or narrowly scoped CSS-only plan.
- No class renaming or runtime behavior change without follow-up approval.

### Phase 3: Header/nav/auth/dropdown/mobile block ownership audit

Map which shared CSS blocks own header, nav, auth dropdown, mobile menu, and icon-loading states.

Deliverable:
- Ownership table and risk notes.
- No header/auth JavaScript changes.

### Phase 4: Minimal CSS-only hardening PRs

Only after inventories are complete, create small CSS-only PRs.

Rules:
- One risk area per PR.
- Preserve visual output.
- Avoid broad selector rewrites.
- Avoid mixed Search/Auth/Editor/API/runtime changes.

### Phase 5: Visual smoke after each CSS PR

Every implementation PR needs visual verification after CSS changes.

Required surfaces include:
- desktop public pages;
- mobile public pages;
- header/nav auth UI;
- Material Symbols load/hide behavior;
- reduced motion / transition behavior if touched.

---

## 5. Guardrails

Implementation follow-up work must observe these guardrails:

- No broad `global.css` rewrite.
- No visual redesign.
- No prototype/reference/demo/variant changes.
- No mixing with primary RGBA token replacement from Issue #224.
- No editor override relocation in the same PR.
- No runtime/header/auth JavaScript changes.
- No Search/Auth/Editor/API/Modal behavior changes.
- No `pages/*.html` changes unless explicitly approved in a later scoped task.

---

## 6. Verification Required Before Implementation

Before any CSS hardening implementation PR is approved, verify the affected surfaces explicitly.

Minimum smoke matrix:

- Desktop public pages.
- Mobile public pages.
- Header/nav auth UI smoke.
- Material icons load/hide behavior.
- Reduced motion / transition behavior if touched.

If a PR touches shared header, auth nav, dropdown, mobile nav, or icon-loading rules, it must include browser evidence from production-equivalent preview or assigned fixed test slot.

---

## 7. Next Recommended PR

The next safest PR should be one of:

1. audit-only token/root inventory; or
2. Material Symbols ready-class strategy plan.

Do not start implementation until the relevant inventory or strategy plan is reviewed.

---

## 8. Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/design/GLOBAL_CSS_HARDENING_STRATEGY.md`.
- [ ] No CSS/JS/page/runtime changes.
- [ ] No close keywords for Issue #137.

---

## Notes

Issue #137 remains open because global CSS hardening and other CSS/HTML cleanup backlog items remain pending.
