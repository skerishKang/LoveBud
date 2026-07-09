# LoveBud Scout MVP Manual Review UI Readiness Audit

## 1. Purpose

This document is an **audit-only** record of the UI readiness boundary for the future manual Scout review surface. It is the next step after the save-to-memory payload contract (#3379 / #3380): before any real Scout UI, route, provider, storage, or runtime is implemented, this audit fixes what the future manual review surface must guarantee.

It is an audit and boundary document, not an implementation. It contains no UI code, no route, no fetcher, no crawler, no scraper, no provider wiring, no Firebase/auth/runtime change, no DB schema/migration, no storage implementation, and no production smoke. Implementation remains blocked until the gates in this document and in the inherited contracts are accepted.

This audit is a child of the parent Scout product issue (#1882) and inherits the link-source safety boundary (#3364 / #3365), the manual link-to-memory draft flow contract (#3373 / #3375), and the save-to-memory payload contract (#3379 / #3380). It must be read together with those documents.

## 2. Inherited boundaries

This audit is subordinate to:

- the link-source safety boundary (#3364 / #3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3373 / #3375) — states, visible fields, edit-before-save, blocked states
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields

If this audit disagrees with #3365, #3375, or #3379, those documents win.

## 3. Future review surface states

The future manual review surface moves through the following explicit states:

- `empty / ready-to-paste` — no link submitted; paste affordance available
- `validating link` — submitted link being checked for public-link eligibility and safety
- `source blocked` — link falls into a blocked category; safe copy shown, no fetch
- `draft generated` — generated suggestion fields available for review
- `edit-in-progress` — user is editing the draft / reviewed fields
- `save disabled` — reviewed fields incomplete or unsafe; save control disabled
- `save ready` — reviewed fields complete and safe; save enabled
- `save pending` — save action in flight
- `save success` — memory draft saved
- `safe failure / retry` — recoverable failure; safe copy shown; retry offered

## 4. Generated suggestion vs user-reviewed save

The review surface must distinguish two groups carried from #3379:

- generated suggestion fields — Scout-produced values shown for review (may be edited or discarded)
- user-reviewed save fields — values the user accepted/edited and that are saved

Only user-reviewed fields are persisted. The UI must make the distinction visible (for example, an edited/accepted indicator) so the user knows what will be saved.

## 5. Edit-before-save / no auto-save

The user must be able to edit before saving. The save control must not auto-save. `save disabled` is the default until the user has reviewed and completed the reviewed fields. Auto-save is forbidden.

## 6. Source attribution / original source link visibility

The original source link must remain visible throughout the review surface. The draft is marked as generated and user-editable. No official endorsement is implied. Generated content is traceable back to the user-provided link. The source link is the provenance source of truth; generated text is a draft, not a replacement for the source.

## 7. Full-content storage / repost / rehost prohibition (UI copy + behavior)

The UI must never present controls or copy that would store, repost, or rehost full content:

- no full article / full post / full transcript / lyrics / paywalled content storage
- no image / video rehosting
- no full scraped content

These are enforced as both UI copy constraints (no such action offered) and behavior constraints (no such payload constructed).

## 8. Safe text length / truncation feedback

All editable/reviewed text fields have a safe maximum length. When a field approaches or exceeds the limit, the UI must give clear truncation feedback (count/warning) and let the user edit before save. Truncation must never produce or retain raw/private values.

## 9. Safe error copy / no raw backend or provider output

Every error shown in the review surface must be safe copy: non-technical, non-leaking, free of raw backend/provider output, stack traces, tokens, cookies, session values, or private identifiers. Retry is offered without exposing the underlying failure detail.

## 10. Accessibility / keyboard / focus requirements

The future review surface must meet baseline accessibility expectations:

- full keyboard operability of paste, edit, and save controls
- visible focus indicators on all interactive elements
- logical focus order and focus management for the save flow
- labels/instructions associated with each editable field
- errors announced through an accessible mechanism, not only color
- no keyboard trap during edit or save

These are forward-looking requirements for the future UI child; this audit defines them, it does not implement them.

## 11. Route / storage / provider handoff boundaries

When implementation begins later, it must be split into separate child issues, each gated and reviewed:

- route child — server/client entry that accepts the reviewed payload from #3379
- storage child — persists only the allowed #3365 fields
- provider/fetcher child — only if ever explicitly allowed and reviewed later, behind its own gate
- UI child — renders the review surface per this audit

Each child must re-accept this audit and the inherited #3365 / #3375 / #3379 boundaries before code is written.

## 12. Feature flag / prototype route gating

If implementation begins later, the review surface must ship behind a feature flag or prototype route gate. It must not be reachable in production unless the gate is explicitly enabled through a later reviewed activation path. The gate is a hard prerequisite.

## 13. No real platform request / no production smoke

The future review surface, even when implemented later, must not issue real platform requests (no real YouTube / Instagram / X / Weverse / news requests) and must not run production smoke against live platforms from this audit's scope. Those require their own later-reviewed gates.

## 14. Raw / private exposure restrictions

Raw/private values must never appear in any of the following surfaces:

- UI copy
- logs
- test fixtures
- screenshots
- PR evidence
- reports

Forbidden raw/private values include: raw/private IDs, tokens, cookies, auth headers, API base URLs, dashboard URLs, DB rows, request / response bodies, and private logs/screenshots. Safe copy only, everywhere.

## 15. Explicit non-goals

- generic translation app
- crawler / scraper / automatic source discovery
- reposting tool
- full content archive
- copyright bypass
- provider / LLM wiring
- Firebase / auth / runtime changes
- DB schema / migration / storage implementation
- production smoke against real platforms
- real platform requests
- social likes / comments work (#3188 / #3075 out of scope)

## 16. Cross-links

- Refs #3383
- Refs #1882
- Refs #3379
- Refs #3380
- Refs #3373
- Refs #3375
- Refs #3364
- Refs #3365
- Refs #3188
- Refs #3075
