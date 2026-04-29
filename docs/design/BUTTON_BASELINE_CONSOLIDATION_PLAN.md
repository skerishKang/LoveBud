# Button Baseline Consolidation Plan

## Status

Planning document only.

This document does not authorize CSS changes, selector changes, token changes, or runtime behavior changes.

---

## Background

`css/global.css` currently contains two effective primary button layers:

```text
1. Upper baseline definition
   .btn-primary
   .btn-primary:hover

2. Lower PR3 override layer
   body .btn-primary
   body .btn-primary:hover
```

The lower `body .btn-primary` PR3 override currently wins by selector specificity and source order. This keeps the visible control tone aligned with the PR3 button / badge / chip unification work.

However, the upper `.btn-primary` baseline may still be serving as a fallback or as a baseline for selectors not fully covered by the lower PR3 layer. It must not be deleted without page-level visual verification.

---

## Problem

The coexistence of the upper `.btn-primary` baseline and the lower `body .btn-primary` override creates maintenance ambiguity:

```text
- contributors may not know which layer is the source of truth
- future button changes may patch the wrong selector layer
- changing one layer without the other can create silent visual drift
- removing the upper baseline too early can regress pages that depend on inherited baseline behavior
```

This is a design-system consolidation issue, not a runtime issue.

---

## Current known risk

Immediate deletion is not safe.

Potential visual regression surfaces include:

```text
- landing page hero CTA
- intro hero CTA
- intro final CTA section
- search / browse filter and action controls
- detail appreciation CTA
- editor action buttons
- shared auth/login buttons if they inherit global button styling
```

The main risk is not that the upper baseline is definitely required. The risk is that its removal has not yet been measured against every user-facing button context.

---

## Consolidation direction

A later CSS PR should first decide the button token source of truth.

Candidate source-of-truth structure:

```text
:root control tokens
  -> generic button primitives
     -> page-specific CTA variants only where necessary
```

The consolidation PR should explicitly classify the following selectors before editing CSS:

```text
.btn-round
.btn-primary
.btn-outline
.intro-cta-primary
.intro-cta-secondary
.cta-appreciation
.tag-chip
.preview-badge
.growing-trees-badge
.browse-results-badge
.how-to-badge
.emotion-tag-refined
```

Expected outcome:

```text
- one clear primary button baseline
- one clear outline button baseline
- documented exceptions for page-specific CTA effects
- no duplicate source-of-truth layer for the same visual role
```

---

## Required audit before CSS changes

Before removing or rewriting any button baseline, the executor must inspect current usage across HTML/CSS.

Required checks:

```text
- find every `.btn-primary` usage
- find every `.btn-outline` usage
- find every `.btn-round` usage
- find every `.intro-cta-primary` and `.intro-cta-secondary` usage
- find every `.cta-appreciation` usage
- find every `.tag-chip` usage
- confirm which CSS file currently owns each selector
- confirm which selector wins in computed style on representative pages
```

Do not rely on source order inspection only. The later implementation PR must include browser visual verification.

---

## Visual smoke matrix

The CSS consolidation PR must verify at least these surfaces:

```text
Landing
- `/`
- primary hero CTA
- secondary hero CTA
- mobile 390px CTA stacking

Intro
- `/pages/intro.html`
- hero primary/secondary CTA
- final CTA section
- mobile 390px CTA stacking and no horizontal overflow

Search / Browse
- `/pages/search.html`
- tag chips
- active chip state
- preview/browse badges
- primary/secondary actions if present

Detail
- `/pages/detail.html`
- appreciation CTA
- badges/tags near public memory content

Editor
- `/pages/editor.html`
- primary action buttons
- outline/secondary action buttons
- mobile action wrapping if relevant
```

Recommended viewport set:

```text
1920x1080
1440x900
390x844
```

---

## Forbidden combinations

Do not combine button baseline consolidation with:

```text
- PR #207 landing/intro CTA visual correction
- landing hero redesign
- intro hero redesign
- Search copy or event delegation changes
- Editor current memory/card polish
- Header/profile dropdown polish
- Modal route extraction
- Auth/Login active provider transition
- backend/API behavior changes
- token palette redesign
```

PR #207 and button consolidation may touch adjacent visual surfaces, but they must remain separate PRs. PR #207 is a landing/intro visual consistency correction. Button baseline consolidation is a global design-system cleanup.

---

## Suggested implementation PR shape

Branch candidate:

```text
refactor/button-baseline-consolidation
```

Allowed files should be decided after audit, but the first implementation should strongly prefer a narrow CSS-only scope.

Likely file candidate:

```text
css/global.css
```

Potentially related page-specific files must not be added unless visual verification proves they are required.

Commit title candidate:

```text
refactor(css): consolidate button baseline definitions
```

---

## Review gates

Gate A: Audit accepted

```text
Selector inventory and current computed-style ownership are documented.
```

Gate B: CSS consolidation PR authorized

```text
CTO approves the exact selector and file scope.
```

Gate C: Visual smoke passed

```text
Landing, Intro, Search, Detail, and Editor smoke pass across desktop and mobile.
```

Gate D: Merge allowed

```text
No runtime behavior changed, no unrelated UI polish included, and no PR #207 scope mixed in.
```

---

## Non-goals

This plan does not authorize:

```text
- deleting `.btn-primary` baseline now
- changing button colors now
- changing design tokens now
- changing page-specific CTA layout now
- changing Search/Editor/Header behavior
- changing runtime or deployment configuration
```
