# LoveBud Scout MVP Save-Memory Storage Writer Contract

## 1. Purpose

This document defines the **contract** for the future Scout save-memory storage writer. It
is the next step after the save-memory storage handoff boundary audit (#3399 / #3397): the
audit fixed what may and may not cross the storage boundary; this contract fixes the
writer/helper shape, the input/output DTOs, the defense-in-depth forbidden fields, the
auth/ownership/tree-selection prerequisite, the idempotency/duplicate-prevention semantics,
the safe audit logging shape, and the safe error/result taxonomy.

It is a contract and documentation document, not an implementation. It contains no storage
writer runtime, no `persistReviewedScoutMemoryDraft` body, no memory insertion, no DB
schema/migration, no client adapter, no UI, no fetcher, no crawler, no scraper, no provider
wiring, no Firebase/auth/runtime change, and no production smoke. The writer is implemented
only by a later implementation child that re-accepts this contract.

This contract is a child of the parent Scout product issue (#1882) and inherits the
link-source safety boundary (#3365), the manual link-to-memory draft flow contract (#3375),
the save-to-memory payload contract (#3379 / #3380), the reviewed payload route intake
contract (#3386 / #3387), the reviewed payload route intake guard (#3395), the reviewed
payload route readiness audit (#3389 / #3390), and the save-memory storage handoff boundary
audit (#3397 / #3399). It must be read together with those documents.

## 2. Inherited boundaries

This contract is subordinate to:

- the link-source safety boundary (#3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3375) — edit-before-save
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields
- the reviewed payload route intake contract (#3386 / #3387) — reviewed-only acceptance, required/optional/forbidden fields, safe error taxonomy, idempotency, storage handoff
- the reviewed payload route intake guard (#3395) — `FORBIDDEN_NAMES` rejection at intake
- the reviewed payload route readiness audit (#3389 / #3390) — route location, shell reuse, auth/storage/idempotency prerequisites
- the save-memory storage handoff boundary audit (#3397 / #3399) — storage allowed/forbidden fields, treeId UNRESOLVED posture, transformation, idempotency/duplicate prevention, safe audit logging, safe error taxonomy

If this contract disagrees with #3365, #3375, #3379, #3383, or #3386, those documents win.

## 3. Future writer / helper location candidates

The storage writer should live alongside the existing Scout API surface and reuse the
established storage-boundary pattern:

- Candidate: a new `functions/api/scout/save-memory-storage.js` under `functions/api/scout/`, invoked by `save-memory.js` only after intake validation passes.
- Alternative: another helper path consistent with repository convention (e.g. a `save-memory-persist.js` sibling). The implementation child owns the final path decision.
- The writer must reuse the existing `js/postgres-client.js` `createMemory` client boundary rather than opening a new DB client or a direct connection.
- The writer reuses the `live-rate-limit-storage-adapter.js` storage-boundary pattern for idempotency/audit key handling.

This is a candidate only; the writer is not implemented in this contract.

## 4. Future export name candidate

The writer should export a function such as:

- `persistReviewedScoutMemoryDraft(...)`

This name is a candidate contract symbol only. **This PR does NOT implement it.** The
implementation child defines the exact signature, but it must satisfy the input/output DTOs
and the boundaries in this contract.

## 5. Input DTO

The writer receives a verified, intake-validated reviewed payload plus a server-resolved
context:

- **Owner / user identity**: taken ONLY from the verified auth context (the signed-in user). The writer must **never** read an owner/user id from the client payload. Client-supplied identity is rejected/ignored.
- **`treeId`**: an explicit target tree identifier is required once tree selection is resolved. If `treeId` is not yet decided by the storage handoff boundary (#3397 / #3399), the posture is **UNRESOLVED / draft-only**: the writer must not invent or guess a tree; it records the unresolved posture and defers the real write until tree selection is supplied by the client/UI integration child.
- **Reviewed payload allowed fields** (carried from intake, never expanded):
  - `sourceLink`
  - `sourceLabel`
  - `memoryDraft`
  - optional bounded `summary`
  - optional bounded `translatedSummary`
  - optional bounded `fanContext`
  - optional bounded `emotionTags`
- **Idempotency key / hash posture**: the writer receives (or derives) an idempotency key from the reviewed payload. It stores only the **SHA-256 hash** of that key for dedupe; the raw key is never stored or echoed.

## 6. Output DTO

The writer returns a safe result object:

- `persistence: 'stored'` is allowed **only after** the implementation child performs the real write. Until then (gated/deferred posture), the route/intake continues to return `persistence: 'gated'`.
- `memoryId` / `treeId` are returned **only when the implementation exists and the write succeeded**; they are safe identifiers, never raw/private values.
- `requestId`: a safe request correlation id.
- **No raw payload echo**: the response must never include the reviewed payload body, forbidden fields, tokens, cookies, auth headers, or any raw/private value.

## 7. Forbidden defense-in-depth fields

The writer must reject (defense-in-depth, even though intake already rejects) any of:

- raw source body
- full scraped content
- full article / full post / full transcript / lyrics / paywalled content
- copied image / copied video
- raw provider output
- raw request / response bodies
- tokens / cookies / auth headers
- API base URLs / dashboard URLs
- DB rows / private logs / screenshots with private IDs

Nothing forbidden is persisted or echoed back. This is the raw/private exposure prohibition
carried from #3365, #3386, #3395, and #3399.

## 8. Auth / ownership / tree-selection prerequisite

- Auth: the writer runs only for a verified owning context (the signed-in user saving into their own LoveTree), reusing the existing `live-auth-verifier-adapter.js` verification boundary. This contract states the prerequisite; it does **not** implement auth.
- Ownership: cross-user payload adoption is forbidden. The writer must verify the requesting user owns the target tree (once `treeId` is resolved) before writing.
- Tree selection: unresolved per #3397 / #3399. The writer must define how the target tree is selected/validated before any write; it must not proceed with an unresolved/draft-only posture as if it were a real persisted memory.

## 9. Idempotency and duplicate-prevention semantics

- The writer derives an idempotency key from the reviewed payload and stores only its SHA-256 hash.
- A repeated submission of the same reviewed payload (same owner, same resolved tree) must not create duplicate memory drafts.
- Beyond idempotency, the writer de-duplicates by the same content+source+owner signature within the target tree; a second accepted save returns the existing memory rather than inserting a duplicate.
- The `duplicate_submission` safe error taxonomy code is reserved for intake-level idempotency rejection; storage-level dedup is a separate, storage-owned guard.

## 10. Safe audit logging

The writer appends only redaction-safe audit metadata:

- request id
- owner id (server-resolved, never client-supplied)
- target tree id — **only if resolved**
- the set of stored field names (never the field values)
- SHA-256 idempotency key hash

It must **never** write: raw idempotency key, request/response body, token, cookie, auth
header, API base URL, dashboard URL, DB row, or screenshot with private ID. Logs are
redaction-safe by construction.

## 11. Safe error / result taxonomy

Writer/storage failures use the #3386 / #3399 safe error taxonomy:

- `invalid_payload` — missing or malformed required field
- `unreviewed_generated_only` — generated-only save rejected
- `forbidden_content` — forbidden field detected (intake or writer defense-in-depth)
- `unsafe_source` — source blocked by #3365 boundary
- `duplicate_submission` — idempotency rejection
- `unauthorized` / `forbidden` — auth/ownership/tree-selection failure
- `persistence_unresolved` — writer cannot write because tree selection is unresolved (draft-only posture)

Every result/error is safe copy: no raw backend output, no provider output, no stack trace,
no token/cookie/session/ID leakage. The response carries only a code, a safe human-readable
message, and the request id.

## 12. Future implementation gates

When implementation begins later, it must be gated and reviewed in order:

1. storage writer implementation — implements `persistReviewedScoutMemoryDraft(...)`, persists only allowed #3365 fields, enforces idempotency/duplicate prevention, reuses `createMemory` boundary
2. client / UI tree selection integration — wires tree selection / `treeId` and the review surface to the route
3. non-prod verification — verifies the writer without live platforms (fixtures, mock client, #3386 taxonomy assertions, idempotency replay)
4. production activation — only after a separate, explicit production-activation approval

Each gate must re-accept this contract and the inherited #3365 / #3375 / #3379 / #3383 /
#3386 / #3387 / #3395 / #3397 / #3399 boundaries before code is written.

## 13. Explicit non-goals

- storage writer runtime implementation (no `persistReviewedScoutMemoryDraft` body)
- memory insertion / persistence flip
- DB schema / migration
- client adapter / UI implementation
- provider / fetcher / crawler / scraper / LLM wiring
- Firebase / auth / runtime changes
- Social likes / comments work (#3188 / #3075 out of scope)
- production smoke against real platforms
- real platform requests

## 14. Cross-links

- Refs #3402
- Refs #1882
- Refs #3397
- Refs #3399
- Refs #3391
- Refs #3395
- Refs #3389
- Refs #3390
- Refs #3386
- Refs #3387
- Refs #3379
- Refs #3380
- Refs #3375
- Refs #3365
- Refs #3188
- Refs #3075
