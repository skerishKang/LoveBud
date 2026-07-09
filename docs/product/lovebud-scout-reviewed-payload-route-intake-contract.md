# LoveBud Scout MVP Reviewed Payload Route Intake Contract

## 1. Purpose

This document defines the **route/action intake boundary** for the reviewed Scout payload. It is the next step after the manual review UI readiness audit (#3383 / #3384): before any real Scout route/action, UI, storage, provider, or runtime is implemented, this contract fixes how a future route/action must accept a user-reviewed Scout payload.

It is a contract-only definition. It contains no route, no page, no action, no client adapter, no UI, no fetcher, no crawler, no scraper, no provider wiring, no Firebase/auth/runtime change, no DB schema/migration, no storage implementation, and no production smoke. Implementation remains blocked until the gates in this document and in the inherited contracts are accepted.

This contract is a child of the parent Scout product issue (#1882) and inherits the link-source safety boundary (#3364 / #3365), the manual link-to-memory draft flow contract (#3373 / #3375), the save-to-memory payload contract (#3379 / #3380), and the manual review UI readiness audit (#3383 / #3384). It must be read together with those documents.

## 2. Inherited boundaries

This intake contract is subordinate to:

- the link-source safety boundary (#3364 / #3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3373 / #3375) — states, visible fields, edit-before-save, blocked states
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields
- the manual review UI readiness audit (#3383 / #3384) — future review surface states and UI boundaries

If this contract disagrees with #3365, #3375, #3379, or #3383, those documents win.

## 3. Route / action intake contract

The future route/action accepts one payload group only: the `reviewed` group produced and accepted by the user in the review surface. The route must read the `reviewed` group and must ignore, drop, or reject any `generated`-only or unmapped content.

The intake boundary is a contract about *acceptance rules*, not an implementation. It describes what a conforming route must do; it does not build the route.

## 4. Accepted payload group: reviewed only

- Only the `reviewed` group is an accepted intake payload.
- A payload that carries only `generated` fields and no `reviewed` group is explicitly rejected.
- A save request containing `generated`-only content, or attempting to promote `generated` into the saved record, is rejected at intake.

This keeps the separation defined in #3379: persisted content is always user-reviewed, never silently promoted generated content.

## 5. Required field validation posture

Intake must validate these required fields and reject when any is missing or unsafe:

- `sourceLink` — original user-provided public link (preserved verbatim)
- `sourceLabel` — short source label / title
- `memoryDraft` — user-editable LoveTree memory draft text

If any required field is absent, malformed, or carries forbidden content, intake returns a safe validation error and stores nothing.

## 6. Optional reviewed fields

These reviewed fields are accepted when present and user-reviewed:

- `summary` — short generated summary
- `translatedSummary` — short translated summary
- `fanContext` — fan-relevant points
- `emotionTags` — emotion tags

Optional fields absent from the reviewed payload are not synthesized by the route.

## 7. Forbidden fields

The intake must reject any payload attempting to carry forbidden content:

- full scraped content
- raw source body
- full article / full post / full transcript / lyrics / paywalled content
- copied image / video
- raw provider output
- raw request / response bodies
- tokens
- cookies
- auth headers
- API base URLs
- dashboard URLs
- DB rows
- private logs
- screenshots with private IDs

Any forbidden field present in the intake payload is rejected with safe copy; nothing forbidden is persisted or echoed back.

## 8. Safe error taxonomy

Intake validation failures use a safe error taxonomy:

- `invalid_payload` — missing or malformed required field
- `unreviewed_generated_only` — generated-only save rejected
- `forbidden_content` — forbidden field detected
- `unsafe_source` — source blocked by #3365 boundary
- `duplicate_submission` — idempotency rejection (see section 9)

Every error is safe copy: no raw backend output, no provider output, no stack trace, no token/cookie/session/ID leakage. The taxonomy names are the only surface; detail stays server-side.

## 9. Idempotency posture

Save submissions must be idempotent. A repeated submission of the same reviewed payload (same source link + same reviewed content fingerprint) must not create duplicate memory drafts. The route defines an idempotency key from the reviewed payload; the storage child enforces it. This contract sets the expectation; the storage child implements it.

## 10. Auth / ownership expectation (no auth implementation)

Intake expects an owning context (the user saving into their own LoveTree) but this contract does **not** implement auth. Auth/ownership enforcement is a separate gated implementation concern. The intake boundary only states the expectation: saved drafts belong to the acting user's tree; no cross-user payload adoption.

## 11. Storage handoff boundary (no storage implementation)

The route/action hands the validated `reviewed` payload to a storage child. This contract defines the handoff boundary — only allowed #3365 fields cross the boundary — but does **not** create a storage implementation. The storage child persists only the allowed set: original source link, short title or source label, short generated summary, short translated summary, fan-relevant points, emotion tags, and the user-editable LoveTree memory draft.

## 12. No real platform request / no provider call / no production smoke

The intake boundary forbids any real platform request (no real YouTube / Instagram / X / Weverse / news request) and any provider call during intake validation. Production smoke against live platforms is out of scope and requires its own later-reviewed gate.

## 13. No UI / no client adapter

This contract defines route/action acceptance rules only. It creates no UI and no client adapter. UI integration and client-adapter construction are separate future child issues.

## 14. Future child split before implementation

When implementation begins later, it must be split into separate child issues, each gated and reviewed:

- route implementation child — accepts the reviewed payload per this contract
- storage implementation child — persists only allowed #3365 fields, enforces idempotency
- UI integration child — wires the review surface (#3383) to the route
- non-prod verification child — verifies intake without live platforms

Each child must re-accept this contract and the inherited #3365 / #3375 / #3379 / #3383 boundaries before code is written.

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

- Refs #3386
- Refs #1882
- Refs #3383
- Refs #3384
- Refs #3379
- Refs #3380
- Refs #3373
- Refs #3375
- Refs #3364
- Refs #3365
- Refs #3188
- Refs #3075
