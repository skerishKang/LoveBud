# LoveBud Scout MVP Reviewed Payload Route Readiness Audit

## 1. Purpose

This document is an **audit-only** record of the readiness boundary for the future Scout reviewed-payload route/action. It is the next step after the reviewed payload route intake contract (#3386 / #3387): before any real Scout route/action is implemented, this audit fixes where the route should live, which existing Scout shells/stubs/adapters/boundaries it should reuse, and which storage/auth/idempotency gates must be in place first.

It is an audit and boundary document, not an implementation. It contains no route, no page, no action, no client adapter, no UI, no fetcher, no crawler, no scraper, no provider wiring, no Firebase/auth/runtime change, no DB schema/migration, no storage implementation, and no production smoke. Implementation remains blocked until the gates in this document and in the inherited contracts are accepted.

This audit is a child of the parent Scout product issue (#1882) and inherits the link-source safety boundary (#3365), the manual link-to-memory draft flow contract (#3375), the save-to-memory payload contract (#3379 / #3380), the manual review UI readiness audit (#3383 / #3384), and the reviewed payload route intake contract (#3386 / #3387). It must be read together with those documents.

## 2. Inherited boundaries

This audit is subordinate to:

- the link-source safety boundary (#3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3375)
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields
- the manual review UI readiness audit (#3383 / #3384) — future review surface states and UI boundaries
- the reviewed payload route intake contract (#3386 / #3387) — reviewed-only acceptance, required/optional/forbidden fields, safe error taxonomy, idempotency, storage handoff

If this audit disagrees with #3365, #3375, #3379, #3383, or #3386, those documents win.

## 3. Future Scout route / action location candidates

The future reviewed-payload route/action should live alongside the existing Scout API surface under `functions/api/scout/`, reusing the same entry layout as the current suggestion endpoint. Candidate location: a new `functions/api/scout/save-memory.js` entry that mirrors the existing `functions/api/scout/suggest.js` shell.

Rationale for the candidate location:

- keeps Scout endpoints co-located under one namespace, matching the existing `functions/api/scout/` convention
- reuses the same adapter/verifier/rate-limit boundary pattern already established by the `live-*` adapters
- keeps the reviewed-payload intake contract (#3386) as the single acceptance authority
- avoids touching any social route/action under `functions/api/` (social lanes are out of scope)

This is a candidate only; the route implementation child owns the final path decision.

## 4. Existing Scout shells / stubs / clients / adapter boundaries to reuse

The audit confirms the following existing artifacts as reuse candidates (reference only, no change here):

- `functions/api/scout/suggest.js` — existing Scout suggestion endpoint shell; the new route should mirror its entry shape
- `js/scout/scout-draft.js` — existing draft model shell
- `js/scout/scout-draft-ui.js` — existing draft UI shell (UI integration child reuses this)
- `js/scout/scout-suggestion-endpoint-client.js` — existing endpoint client boundary
- `js/scout/scout-suggestion-provider.js` — existing provider boundary (provider/fetcher child only, if ever allowed later)
- `functions/api/scout/live-auth-verifier-adapter.js` — existing auth verifier adapter boundary (auth prerequisite reuses this pattern)
- `functions/api/scout/live-provider-adapter.js` — existing provider adapter boundary
- `functions/api/scout/live-rate-limit-storage-adapter.js` — existing rate-limit storage adapter boundary (idempotency/storage child reuses this pattern)

These are boundaries to reuse, not to implement in this audit.

## 5. #3386 reviewed-only intake validation inherited

The future route must inherit the #3386 intake validation: only the `reviewed` payload group is accepted; `generated`-only or unmapped content is ignored or rejected. This audit does not re-define the validation; it records that the route implementation child must call the #3386 acceptance rules.

## 6. Generated-only save rejection

A save request carrying only `generated` fields, or attempting to promote `generated` into the saved record, is rejected. The route implementation child must enforce this at intake, consistent with #3386 and #3379.

## 7. Required field validation posture

The route must validate required fields and reject when any is missing or unsafe:

- `sourceLink` — original user-provided public link (preserved verbatim)
- `sourceLabel` — short source label / title
- `memoryDraft` — user-editable LoveTree memory draft text

## 8. Optional reviewed fields

Accepted when present and user-reviewed:

- `summary`
- `translatedSummary`
- `fanContext`
- `emotionTags`

Absent optional fields are not synthesized by the route.

## 9. Forbidden fields / raw-private exposure prohibition

The route must reject any payload attempting to carry forbidden content:

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

Nothing forbidden is persisted or echoed back. This is the raw/private exposure prohibition carried from #3365 and #3386.

## 10. Safe error taxonomy

Intake validation failures use the #3386 safe error taxonomy:

- `invalid_payload` — missing or malformed required field
- `unreviewed_generated_only` — generated-only save rejected
- `forbidden_content` — forbidden field detected
- `unsafe_source` — source blocked by #3365 boundary
- `duplicate_submission` — idempotency rejection

Every error is safe copy: no raw backend output, no provider output, no stack trace, no token/cookie/session/ID leakage.

## 11. Auth / ownership prerequisite (no auth implementation)

The route requires an owning context (the user saving into their own LoveTree) and must reuse the existing `live-auth-verifier-adapter.js` verification boundary. This audit states the prerequisite; it does **not** implement auth. Cross-user payload adoption is forbidden.

## 12. Storage handoff prerequisite (no storage implementation)

The route hands the validated `reviewed` payload to a storage child, reusing the `live-rate-limit-storage-adapter.js` storage-boundary pattern. This audit defines the handoff prerequisite — only allowed #3365 fields cross the boundary — but does **not** create a storage implementation. The storage child persists only: original source link, short title or source label, short generated summary, short translated summary, fan-relevant points, emotion tags, and the user-editable LoveTree memory draft.

## 13. Idempotency prerequisite

Save submissions must be idempotent: a repeated submission of the same reviewed payload must not create duplicate memory drafts. The route defines an idempotency key from the reviewed payload; the storage child enforces it, reusing the existing rate-limit storage adapter boundary. This audit sets the prerequisite; the storage child implements it.

## 14. Non-prod verification plan (no real platform request / no production smoke)

Before any production path, a non-prod verification child must verify intake using:

- fixture reviewed payloads (no raw/private values)
- mocked endpoint client (no real `fetch`/provider call)
- the #3386 safe error taxonomy assertions
- idempotency replay checks

No real platform request (no real YouTube / Instagram / X / Weverse / news request) and no production smoke against live platforms. These require their own later-reviewed gates.

## 15. Future child split

When implementation begins later, it must be split into separate child issues, each gated and reviewed:

- route implementation child — new `functions/api/scout/save-memory.js` mirroring `suggest.js`, enforcing #3386 intake
- storage implementation child — persists only allowed #3365 fields, enforces idempotency
- UI integration child — wires the #3383 review surface to the route, reusing `scout-draft-ui.js`
- non-prod verification child — verifies intake without live platforms

Each child must re-accept this audit and the inherited #3365 / #3375 / #3379 / #3383 / #3386 boundaries before code is written.

## 16. Explicit non-goals

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

## 17. Cross-links

- Refs #3389
- Refs #1882
- Refs #3386
- Refs #3387
- Refs #3383
- Refs #3384
- Refs #3379
- Refs #3380
- Refs #3375
- Refs #3365
- Refs #3188
- Refs #3075
