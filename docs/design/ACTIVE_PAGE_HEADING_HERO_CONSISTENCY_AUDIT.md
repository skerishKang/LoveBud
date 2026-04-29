# Active Page Heading and Hero Consistency Audit

> **Status:** AUDIT_CAPTURED  
> **Source:** Issue #239  
> **Type:** Docs-only — no HTML, CSS, JS, copy, or runtime changes in this document

---

## 1. Purpose

This document captures the audit result for active-page heading and hero visual consistency across LoveBud.

Before any copy, CSS, or markup change is made, this document classifies each active page by visual role, maps current divergence from the reference visual language, and defines the safe follow-up PR slices for copy-only, heading hierarchy, and motion work.

No code changes are made in this document. All HTML pages, CSS files, and JS files are read-only with respect to this PR.

---

## 2. Audit Source

| Field | Value |
|---|---|
| Source issue | Issue #239 |
| Visual reference (source of truth) | `index.html` (Home) — current authoritative brand expression |
| Audit scope | All active LoveBud pages listed in Section 3 |

---

## 3. Page Type Classification

| Page file | Visual role type | Role description |
|---|---|---|
| `index.html` | **Brand Hero** | Primary brand entry; emotional hero, full visual statement; current source of truth |
| `pages/intro.html` | **Brand Hero** | Secondary brand/onboarding entry; should share brand hero language with `index.html` |
| `pages/search.html` | **Browse Header** | Functional discovery entry; task-oriented header, not brand hero |
| `pages/my-trees.html` | **Workspace Header** | Authenticated user workspace/dashboard; personal, workspace tone |
| `pages/detail.html` | **Detail Hero** | Per-tree public detail view; tree-specific hero, not brand hero |
| `pages/login.html` | **Auth Card Entry** | Auth gate; card-based compact entry, minimal heading treatment |
| `pages/settings.html` | **Settings Modal/Card Entry** | Utility page; settings card or modal entry, no hero treatment |

---

## 4. Current Divergence Summary

### 4.1 Home (`index.html`) — Visual Source of Truth

| Aspect | Current state |
|---|---|
| Heading treatment | Brand hero scale; display-weight heading; full visual presence |
| Hero visual | Present; brand-consistent |
| Copy tone | Emotional, brand-forward |
| Status | **Reference — do not change** |

---

### 4.2 Intro (`pages/intro.html`) — Brand Language Mismatch

| Aspect | Current state | Expected |
|---|---|---|
| Heading treatment | **VERIFY: may differ from Home hero scale** | Brand hero scale matching `index.html` |
| Hero visual | **VERIFY: presence and visual weight** | Brand-consistent hero |
| Copy tone | **VERIFY: onboarding copy vs. brand copy** | Emotional brand-forward, matching Home register |
| Divergence risk | Medium — same role type as Home but possibly inconsistent copy or scale | |

**Proposed fix:** Copy-only PR aligning Intro brand language to Home register. No CSS or markup change.

---

### 4.3 Search (`pages/search.html`) — Title/Eyebrow Hierarchy

| Aspect | Current state | Expected |
|---|---|---|
| Heading treatment | **VERIFY: title/eyebrow hierarchy and scale** | Browse header: task-oriented, smaller than brand hero |
| Eyebrow / section label | **VERIFY: presence** | Short eyebrow label (e.g., `탐색` / `Browse`) above functional heading |
| Copy tone | **VERIFY: functional vs. brand** | Functional, discovery-oriented; not brand hero copy |
| Divergence risk | Low-Medium — Browse header is distinct role; risk is in heading scale mismatch | |

**Proposed fix:** Copy-only PR adjusting title/eyebrow copy. Heading token/scale change deferred to heading hierarchy PR.

---

### 4.4 My Trees (`pages/my-trees.html`) — Workspace/Dashboard Tone

| Aspect | Current state | Expected |
|---|---|---|
| Heading treatment | **VERIFY: heading scale and personalization** | Workspace header: personal greeting or workspace title, not brand hero |
| Personalization | **VERIFY: user name / °OO님의 트리° pattern** | Warm, personal workspace tone |
| Copy tone | **VERIFY: dashboard vs. marketing copy** | Dashboard-appropriate, not promotional |
| Divergence risk | Low-Medium — clear role distinction from brand hero; risk is tone mismatch | |

**Proposed fix:** Copy-only PR adjusting workspace header copy. CSS/token changes deferred.

---

### 4.5 Detail (`pages/detail.html`) — Hero Scale

| Aspect | Current state | Expected |
|---|---|---|
| Heading treatment | **VERIFY: hero scale relative to Home** | Detail hero: tree-specific, prominent but subordinate to brand hero |
| Hero visual | **VERIFY: tree cover image as hero** | Tree cover image as hero; title overlay or below-hero heading |
| Copy tone | **VERIFY: public-facing tree description** | Descriptive, tree-specific; not brand copy |
| Divergence risk | Medium — hero scale may be over- or under-powered relative to brand hero | |

**Proposed fix:** Heading token/CSS hierarchy PR (after copy-only PRs). Cover image hero treatment is CSS-only and visually risk-adjacent.

---

### 4.6 Login (`pages/login.html`) — Auth Card Copy Alignment

| Aspect | Current state | Expected |
|---|---|---|
| Heading treatment | **VERIFY: card heading scale** | Auth card entry: compact heading, not hero scale |
| Copy tone | **VERIFY: heading/subheading in auth card** | Welcoming, low-friction; aligned with brand voice but compact |
| Error/prompt copy | **VERIFY: alignment with brand copy register** | Consistent Korean/English copy tone |
| Divergence risk | Low — role is clearly distinct; risk is copy tone mismatch only | |

**Proposed fix:** Copy-only PR adjusting auth card heading/subheading. No heading token or layout change.

---

### 4.7 Settings (`pages/settings.html`) — Classification Only

| Aspect | Current state | Expected |
|---|---|---|
| Visual role | Settings Modal/Card Entry | Utility; no hero treatment expected |
| Heading treatment | **VERIFY: heading scale in settings card/modal** | Compact utility heading; lowest visual weight |
| Runtime bug | None in scope for this audit | Settings runtime bugs tracked separately |

**Note:** Settings classification is recorded here for completeness. No runtime bug work, no copy or CSS changes, in this or any follow-up UX PR without separate approval.

---

## 5. Divergence Summary Table

| Page | Role type | Divergence area | Risk level | Proposed fix PR |
|---|---|---|---|---|
| `index.html` | Brand Hero | None — reference | — | Do not change |
| `pages/intro.html` | Brand Hero | Copy tone / brand language mismatch | Medium | Copy-only PR (Intro) |
| `pages/search.html` | Browse Header | Title/eyebrow hierarchy and copy tone | Low-Medium | Copy-only PR (Search/My Trees/Login) |
| `pages/my-trees.html` | Workspace Header | Workspace/dashboard tone | Low-Medium | Copy-only PR (Search/My Trees/Login) |
| `pages/detail.html` | Detail Hero | Hero scale relative to brand hero | Medium | Heading token/CSS PR (after copy PRs) |
| `pages/login.html` | Auth Card Entry | Auth card copy alignment | Low | Copy-only PR (Search/My Trees/Login) |
| `pages/settings.html` | Settings Card Entry | Classification only; no runtime bug | Low | Classification noted; no immediate PR |

---

## 6. Recommended PR Split

| PR | Scope | Allowed files | Pre-condition |
|---|---|---|---|
| **PR A** | Audit docs (this PR) | `docs/design/ACTIVE_PAGE_HEADING_HERO_CONSISTENCY_AUDIT.md` | — |
| **PR B** | Copy-only: Intro brand language | `pages/intro.html` heading/subheading copy only | PR A merged; CTO copy approval |
| **PR C** | Copy-only: Search, My Trees, Login | `pages/search.html`, `pages/my-trees.html`, `pages/login.html` heading/subheading copy only | PR A merged; CTO copy approval |
| **PR D** | Heading token / CSS hierarchy | CSS heading token adjustments for Detail hero scale | PR B + PR C merged; visual smoke passing |
| **PR E** | Motion / reveal | Scroll reveal or heading entrance animation | PR D merged; reduced-motion compliance confirmed; separate CTO approval |

**Important constraints for PR B and PR C:**
- Copy changes only — no CSS selector, no layout attribute, no JS changes.
- Each PR is a single-page or tightly-scoped multi-page copy edit.
- Browser smoke required before merge: heading visible, no layout shift, no console errors.

---

## 7. Guardrails

- **No CSS changes in this document or its PR.**
- **No page markup (HTML) changes.** `index.html` and all `pages/*.html` are read-only.
- **No JS changes.**
- **No Auth/API/Search/MyTrees runtime behavior changes.**
- **No `pages/editor.html` changes.**
- **Do not touch PR #319 through #331.**
- **Do not touch PR #7 or prototype/reference/demo/variant files.**
- **Issue #239 remains open** — this document does not close, fix, or resolve it.

---

## 8. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to `docs/design/ACTIVE_PAGE_HEADING_HERO_CONSISTENCY_AUDIT.md`
- [ ] No HTML/CSS/JS/runtime changes
- [ ] No `close`/`fixes`/`resolves` keywords for #239
