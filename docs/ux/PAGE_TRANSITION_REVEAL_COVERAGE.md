# Page Transition Reveal Coverage Map

## Purpose

Document the current coverage and classification of page transition and reveal effects for active non-editor pages in LoveBud/LoveTree. This serves as the foundation for implementing consistent page enter transitions and upward text reveals across the application.

## Current Coverage Map

| Page | Current Transition/Reveal | Status | Notes |
|------|---------------------------|--------|-------|
| `index.html` | `.reveal` based scroll reveal | ✅ Implemented | Scroll-triggered text reveals on home page |
| `pages/intro.html` | Tree grow animation only | ⚠️ No shared transition | Has tree-specific animation, lacks page enter transition |
| `pages/login.html` | No shared page enter transition | ❌ Missing | Direct content visibility |
| `pages/search.html` | No shared page enter transition | ❌ Missing | Direct content visibility |
| `pages/detail.html` | No shared page enter transition | ❌ Missing | Direct content visibility |
| `pages/my-trees.html` | No shared page enter transition | ❌ Missing | Direct content visibility |

## Page Type Classification

### Public Static-ish Pages

- `index.html` - Landing page with existing scroll reveals
- `pages/intro.html` - Onboarding page with tree animation

### Public Data-loading Pages

- `pages/search.html` - Browse/search with API data loading
- `pages/detail.html` - Detail view with runtime content

### Protected/Auth-pending Pages

- `pages/login.html` - Authentication entry point
- `pages/my-trees.html` - User dashboard requiring auth

### Detail/Runtime Placeholder Pages

- `pages/detail.html` - Content replaced at runtime via API

## Risk Notes

### Search Skeleton Visibility

- **Risk**: Delayed skeleton visibility could hurt perceived performance
- **Requirement**: Skeleton must remain immediately visible
- **Implementation**: Page transition should not interfere with skeleton display

### Detail Placeholder Runtime Replacement

- **Risk**: Page transition could conflict with runtime content replacement
- **Requirement**: Smooth handoff from placeholder to actual content
- **Implementation**: Defer reveal until content is in DOM

## Implementation Phases (Recommended)

### Phase 1 — Foundation (Core Static Pages)

- Target: `index.html` (already has reveals), `pages/intro.html`
- Goal: Standardize `.reveal` class usage, unify duration/easing
- Scope: CSS only; no JS changes

### Phase 2 — Public Data-loading Pages

- Target: `pages/search.html`, `pages/detail.html`
- Goal: Add page-enter transition that coexists with skeleton loading states
- Scope: CSS + minor JS orchestration to defer until API data ready

### Phase 3 — Auth-protected Pages

- Target: `pages/login.html`, `pages/my-trees.html`
- Goal: Ensure transitions work across auth redirects and session recovery
- Scope: CSS + verify no FOUC on redirect

## Technical Guidelines

- Use CSS `@keyframes` for upward text reveals (translateY(10px) → 0, opacity 0→1)
- Duration: 300–400ms, ease-out curve
- Stagger child elements by 50ms increments
- Apply `.reveal` class as page-enter trigger; remove after animation
- Respect `prefers-reduced-motion` — disable if set

## Related

- [design/UI_DESIGN_SYSTEM.md](../design/UI_DESIGN_SYSTEM.md) — motion principles
- [engineering/MANUAL_TEST_CHECKLIST.md](../engineering/MANUAL_TEST_CHECKLIST.md) — manual smoke verification
- `scripts/e2e-ui-regression-smoke.js` — existing UI smoke script
