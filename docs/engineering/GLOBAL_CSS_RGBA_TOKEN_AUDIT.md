# Global CSS RGBA Token Audit

## Purpose

This document audits repeated direct uses of the primary color RGBA literal in `css/global.css` before any token replacement work.

- Related issue: #224 checklist item #2
- Scope: audit-only documentation
- Target pattern: `rgba(144, 73, 81, X)`
- Implementation status: no CSS changes in this PR

---

## Scope

This audit covers only `css/global.css` on current `main`.

It does not modify:

- `css/global.css`
- generated CSS
- prototype/reference/demo/variant CSS
- runtime HTML/JS/API/Auth/Editor files

---

## Findings

`css/global.css` currently contains **18** direct primary RGBA uses matching `rgba(144, 73, 81, X)`.

| Area / selector | Literal | Current purpose | Replacement candidate |
|---|---:|---|---|
| `.btn-primary` | `rgba(144, 73, 81, 0.2)` | primary button shadow | `rgba(var(--primary-rgb), 0.2)` |
| `.btn-primary:hover` | `rgba(144, 73, 81, 0.3)` | primary button hover shadow | `rgba(var(--primary-rgb), 0.3)` |
| `.cta-appreciation:hover` | `rgba(144, 73, 81, 0.25)` | appreciation CTA hover shadow | `rgba(var(--primary-rgb), 0.25)` |
| `.card-appreciation:hover` | `rgba(144, 73, 81, 0.12)` | appreciation card hover shadow | `rgba(var(--primary-rgb), 0.12)` |
| `.save-status-indicator.saving` | `rgba(144, 73, 81, 0.08)` | saving state background | `rgba(var(--primary-rgb), 0.08)` |
| `body .btn-primary`, `body .cta-appreciation` | `rgba(144, 73, 81, 0.2)` | PR3 primary CTA shadow | `rgba(var(--primary-rgb), 0.2)` |
| `body .btn-primary:hover`, `body .cta-appreciation:hover` | `rgba(144, 73, 81, 0.28)` | PR3 primary CTA hover shadow | `rgba(var(--primary-rgb), 0.28)` |
| `body .btn-outline:hover` | `rgba(144, 73, 81, 0.22)` | outline hover border | `rgba(var(--primary-rgb), 0.22)` |
| `body .intro-cta-primary` | `rgba(144, 73, 81, 0.2)` | intro CTA shadow | `rgba(var(--primary-rgb), 0.2)` |
| `body .intro-cta-primary:hover` | `rgba(144, 73, 81, 0.28)` | intro CTA hover shadow | `rgba(var(--primary-rgb), 0.28)` |
| `body .intro-cta-secondary` | `rgba(144, 73, 81, 0.16)` | intro secondary border | `rgba(var(--primary-rgb), 0.16)` |
| `body .intro-cta-secondary:hover` | `rgba(144, 73, 81, 0.28)` | intro secondary hover border | `rgba(var(--primary-rgb), 0.28)` |
| `body .tag-chip:hover` | `rgba(144, 73, 81, 0.06)` | tag chip hover background | `rgba(var(--primary-rgb), 0.06)` |
| `body .tag-chip:hover` | `rgba(144, 73, 81, 0.18)` | tag chip hover border | `rgba(var(--primary-rgb), 0.18)` |
| `body .preview-badge`, `body .growing-trees-badge`, `body .browse-results-badge`, `body .how-to-badge` | `rgba(144, 73, 81, 0.06)` | badge background | `rgba(var(--primary-rgb), 0.06)` |
| same badge group | `rgba(144, 73, 81, 0.1)` | badge border | `rgba(var(--primary-rgb), 0.1)` |
| `body .emotion-tag-refined` | `rgba(144, 73, 81, 0.08)` | emotion tag background | `rgba(var(--primary-rgb), 0.08)` |
| `body .emotion-tag-refined` | `rgba(144, 73, 81, 0.12)` | emotion tag border | `rgba(var(--primary-rgb), 0.12)` |

---

## Existing token candidate

`css/global.css` already uses `rgba(var(--primary-rgb), X)` for some control tokens:

- `--control-chip-border: rgba(var(--primary-rgb), 0.08)`
- `--control-chip-active-bg: rgba(var(--primary-rgb), 0.12)`
- `--control-chip-active-border: rgba(var(--primary-rgb), 0.16)`
- `--control-focus-ring: rgba(var(--primary-rgb), 0.42)`

Therefore, most direct `rgba(144, 73, 81, X)` values can likely be replaced with `rgba(var(--primary-rgb), X)` without adding a new token.

---

## Replacement strategy candidates

### Candidate A — Literal-to-token syntax replacement

Replace only direct literals with equivalent `rgba(var(--primary-rgb), X)` values.

Pros:
- smallest CSS diff
- no new semantic token naming required
- preserves opacity values exactly

Risks:
- still leaves visual semantics spread across selectors
- requires browser visual smoke because shadows/borders can be sensitive

### Candidate B — Semantic shadow/border tokens

Introduce specific tokens for common repeated roles, for example:

- `--primary-shadow-soft`
- `--primary-shadow-hover`
- `--primary-border-subtle`
- `--primary-bg-subtle`

Pros:
- clearer design intent
- easier future tuning

Risks:
- larger token design decision
- higher chance of overfitting one page/state
- should be planned in design token docs before implementation

---

## Recommendation

Use Candidate A first in a later CSS-only PR:

- replace the 18 direct literal instances in `css/global.css`
- preserve every alpha value exactly
- do not change selector grouping or visual behavior
- do not touch generated/prototype/reference CSS
- verify Home, Intro, Search/Browse, Detail, My Trees, Login, and Settings visual smoke where applicable

Do not introduce new semantic tokens unless the design system explicitly needs shared shadow/border vocabulary beyond the existing `--primary-rgb` token.

---

## Future implementation gate

Before a CSS implementation PR:

- [ ] confirm `--primary-rgb` is defined in active tokens
- [ ] confirm all 18 literal instances still exist on latest `main`
- [ ] keep alpha values unchanged
- [ ] run `git diff --check`
- [ ] verify no generated/prototype/reference/demo/variant files changed
- [ ] browser smoke active public pages for obvious visual regression

---

## Non-goals

- No CSS changes in this PR
- No broad token redesign
- No global search/replace outside `css/global.css`
- No generated/prototype/reference/demo/variant CSS changes
- No runtime/API/Auth/Editor JS changes
- No Issue #224 closure

---

## Related

Refs #224
