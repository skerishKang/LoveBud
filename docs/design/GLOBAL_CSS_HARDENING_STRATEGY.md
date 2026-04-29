# Global CSS Hardening Strategy

> **Status:** STRATEGY_ONLY
> **Source:** Issue #137
> **Type:** Docs-only — no CSS implementation in this PR
> **Version:** v2 (2026-04-29) — expanded with token/ready-class/transition detail

---

## 1. Purpose

This document records the global CSS hardening strategy before implementation.

The goal is to reduce risk around `css/global.css` and related shared styling surfaces by documenting known findings, phased implementation order, guardrails, and required verification before any CSS changes are made.

This strategy intentionally does **not** implement CSS changes. It is a planning baseline for later small, scoped PRs.

---

## 2. Current Known Findings

The following findings are known from the current Issue #137 cleanup backlog and related audits:

- `:root` appears in multiple blocks.
- `--control-*` tokens exist in a later root block, potentially duplicating or shadowing earlier declarations.
- Material Symbols loading state is split between `.ms-fonts-loaded` and `html.material-symbols-ready`.
- The global `.material-symbols-outlined` hiding rule has broad impact across all pages.
- `transition: none` appears in nav, auth, and icon-loading areas; these suppressions belong in a UX polish phase, not a structural hardening pass.

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

## 4. Item-by-Item Hardening Decisions

### 4.1 `:root` Duplicate Block Consolidation

**Finding:** Multiple `:root` blocks exist in `css/global.css`. Later blocks may re-declare or partially override tokens defined in earlier blocks.

**Decision:**
- Inventory all `:root` blocks and their token lists before moving or merging any declarations.
- Do not merge blocks until the inventory confirms no value conflicts.
- Consolidation must be a CSS-only, behavior-neutral PR with full smoke verification.
- Do not combine `:root` consolidation with any selector rule changes.

---

### 4.2 `--control-*` Token Consolidation

**Finding:** `--control-*` tokens (e.g. `--control-border-radius`, `--control-padding`, `--control-height` or equivalent) appear in a later `:root` block. It is unclear whether these duplicate, extend, or conflict with tokens in the primary `:root` block.

**Decision:**
- **Audit first**: Map every `--control-*` declaration and every usage site before any consolidation.
- If a token is only declared and never used, mark it as a dead declaration candidate. Dead declarations may be removed in a CSS-only cleanup PR after audit confirmation.
- If a token is used by editor, search, or shared header CSS, it must not be removed or renamed without a cross-file impact check.
- Token value changes are prohibited in this hardening phase. Only structural de-duplication is allowed.
- `--control-*` consolidation must be its own isolated PR. Do not combine with `:root` block merge or ready-class work.

---

### 4.3 `.ms-fonts-loaded` vs `html.material-symbols-ready` Ready-Class Unification

**Finding:** Material Symbols loading state uses two different class names:
- `.ms-fonts-loaded` — applied to a parent element when the font finishes loading.
- `html.material-symbols-ready` — applied to `<html>` by a separate readiness guard.

Both may drive the same hiding/showing behavior for `.material-symbols-outlined` icons, creating a split-state risk.

**Judgment:**
- **Do not rename or remove either class in this PR.** Class renaming touches runtime JS that sets these classes and CSS rules that consume them simultaneously — this is not docs-only work.
- The correct unification path is:
  1. Audit all JS files that set `.ms-fonts-loaded` or `html.material-symbols-ready`.
  2. Audit all CSS rules that check `.ms-fonts-loaded` or `html.material-symbols-ready`.
  3. Determine which class is the authoritative signal and which is redundant.
  4. Propose a single-class replacement in a dedicated CSS + JS PR after audit.
- Until that audit is complete, treat both classes as active. Do not suppress or remove either guard.

---

### 4.4 Global `.material-symbols-outlined` Hiding Rule Risk

**Finding:** A global rule hides all `.material-symbols-outlined` elements until the ready-class is set. This rule is broad and affects every page.

**Risk:**
- If the ready-class is never set (e.g. due to a network failure, a JS error, or a race condition), all Material Symbols icons remain invisible permanently.
- The rule has no timeout fallback or degraded-state style.

**Decision:**
- Do not remove or relax this rule without a replacement degraded-state strategy.
- Any scoping or timeout strategy is a separate implementation PR that requires visual smoke on all pages.
- Document the risk here; do not act on it in a docs-only PR.

---

### 4.5 `transition: none` → UX Polish Separation

**Finding:** `transition: none` declarations appear in nav, auth container, and icon-loading state rules. These suppress transitions in specific contexts, likely to prevent flash-of-content during initial load or auth state changes.

**Decision:**
- **Do not remove or modify `transition: none` declarations in a structural hardening PR.**
- `transition: none` changes belong in a **UX polish phase**, not in token consolidation or structural cleanup.
- Rationale: Removing `transition: none` without a replacement transition definition will cause visible flash or jarring state changes. This requires design review and smoke testing across auth and icon-loading states.
- The UX polish phase must be a separate PR with explicit visual verification on desktop and mobile, covering:
  - header/nav transition behavior;
  - auth container show/hide transition;
  - Material Symbols icon load transition.

---

## 5. Broad CSS Split Prohibition

**Broad CSS split is prohibited in this hardening context.**

A broad CSS split means:
- Moving large blocks of rules between files in a single PR.
- Reorganizing `css/global.css` into multiple sub-files in one step.
- Combining structural, token, and selector changes in one PR.

**Why:**
- Broad splits make diff review unreliable. Reviewers cannot confirm behavior neutrality across a large move.
- Broad splits create merge conflicts with concurrent CSS PRs.
- Broad splits mix multiple risk areas, making rollback coarse.

Each hardening PR must be scoped to one risk area. See the Implementation PR Split table in §7.

---

## 6. Recommended Implementation Phases

### Phase 1: Token/root inventory only

Inventory all `:root` blocks and token declarations before moving or replacing anything.

Deliverable:
- Audit-only document or small test/report.
- No CSS changes.

### Phase 2: Material Symbols ready-class strategy

Clarify the intended relationship between `.ms-fonts-loaded`, `html.material-symbols-ready`, and the broad `.material-symbols-outlined` hiding rule. See §4.3 and §4.4 for judgment.

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

## 7. Implementation PR Split

| PR | Scope | Prohibited combinations |
|---|---|---|
| PR A | `:root` block inventory audit (docs-only) | No CSS changes |
| PR B | `--control-*` token usage audit (docs-only) | No CSS changes |
| PR C | `.ms-fonts-loaded` / `html.material-symbols-ready` unification plan (docs + narrow CSS-only) | No JS class rename in same PR |
| PR D | Dead `--control-*` token removal (CSS-only, audit-confirmed) | No value changes; no selector changes |
| PR E | UX polish pass: `transition: none` replacement (CSS-only, design-reviewed) | No structural token work in same PR |

Each PR must be independently reviewable. Do not combine PR A–E in a single PR.

---

## 8. Guardrails

Implementation follow-up work must observe these guardrails:

- No broad `global.css` rewrite.
- No visual redesign.
- No prototype/reference/demo/variant changes.
- No mixing with primary RGBA token replacement from Issue #224.
- No editor override relocation in the same PR.
- No runtime/header/auth JavaScript changes.
- No Search/Auth/Editor/API/Modal behavior changes.
- No `pages/*.html` changes unless explicitly approved in a later scoped task.
- No broad CSS split (see §5).
- No `transition: none` removal in structural hardening PRs (see §4.5).
- No ready-class renaming without prior JS + CSS audit (see §4.3).

---

## 9. Verification Required Before Implementation

Before any CSS hardening implementation PR is approved, verify the affected surfaces explicitly.

Minimum smoke matrix:

- Desktop public pages.
- Mobile public pages.
- Header/nav auth UI smoke.
- Material icons load/hide behavior.
- Reduced motion / transition behavior if touched.

If a PR touches shared header, auth nav, dropdown, mobile nav, or icon-loading rules, it must include browser evidence from production-equivalent preview or assigned fixed test slot.

---

## 10. Next Recommended PR

The next safest PR should be one of:

1. audit-only `:root` token/block inventory (PR A); or
2. audit-only `--control-*` token usage map (PR B).

Do not start implementation until the relevant inventory or strategy plan is reviewed.

---

## 11. Verification Checklist

- [ ] `git diff --check` passes.
- [ ] Changed files limited to `docs/design/GLOBAL_CSS_HARDENING_STRATEGY.md`.
- [ ] No CSS/JS/page/runtime changes.
- [ ] No close keywords for Issue #137.

---

## Notes

Issue #137 remains open because global CSS hardening and other CSS/HTML cleanup backlog items remain pending.
