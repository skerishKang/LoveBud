# LoveBud Scout MVP Save-Memory Storage Handoff Boundary Audit

## 1. Purpose

This document is an **audit-only** record of the storage handoff boundary for the Scout
save-memory reviewed payload. It is the next step after the reviewed payload route intake
guard (#3395 / #3386 / #3387): now that `functions/api/scout/save-memory.js` accepts and
intake-validates a `reviewed` payload and returns `persistence: 'gated'`, this audit fixes
what may and may not cross the boundary into real LoveTree memory storage, and what must be
resolved before a storage writer is written.

It is an audit and boundary document, not an implementation. It contains no storage writer,
no memory insertion, no DB schema/migration, no client adapter, no UI, no fetcher, no
crawler, no scraper, no provider wiring, no Firebase/auth/runtime change, and no production
smoke. Implementation remains blocked until the gates in this document and in the inherited
contracts are accepted.

This audit is a child of the parent Scout product issue (#1882) and inherits the link-source
safety boundary (#3365), the manual link-to-memory draft flow contract (#3375), the
save-to-memory payload contract (#3379 / #3380), the reviewed payload route intake contract
(#3386 / #3387), the reviewed payload route intake guard (#3395), the reviewed payload route
readiness audit (#3389), and the reviewed payload route readiness audit record (#3390). It
must be read together with those documents.

## 2. Inherited boundaries

This audit is subordinate to:

- the link-source safety boundary (#3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3375) — edit-before-save
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields
- the reviewed payload route intake contract (#3386 / #3387) — reviewed-only acceptance, required/optional/forbidden fields, safe error taxonomy, idempotency, storage handoff
- the reviewed payload route intake guard (#3395) — `FORBIDDEN_NAMES` rejection at intake
- the reviewed payload route readiness audit (#3389) — route location, shell reuse, auth/storage/idempotency prerequisites
- the reviewed payload route readiness audit record (#3390) — readiness record

If this audit disagrees with #3365, #3375, #3379, #3383, or #3386, those documents win.

## 3. Current memory creation / storage conventions

Reference only — these are the existing conventions the storage child must reuse, not change:

- Browser client boundary: `js/postgres-client.js` exposes `apiClient.createMemory(payload)` which calls `POST /memories`. This is the canonical create-memory entry the storage child should reuse.
- Editor save flow: `js/editor/editor-memory-form-save.js` `createMemoryWithFallback(newMemoryData)` calls `apiClient.createMemory` and falls back to a local save on failure. The memory payload carries a title/label, the memory draft text (`memoryDraft`), a source link for source-type memories, and optional emotion/safety fields.
- Backend storage: memory rows are bounded to allowed fields only; memory visibility inherits the parent tree visibility per `docs/doc_index.md` visibility rules (public default, Plus private storage, explicit memory visibility overrides only within backend policy).
- No Scout route today performs a memory insert. `functions/api/scout/save-memory.js` validates intake and returns `persistence: 'gated'`, intentionally deferring the real write to a later storage child.

## 4. Future Scout storage writer / helper location candidates

The storage child should live alongside the existing Scout API surface and reuse the
established storage-boundary pattern:

- Candidate: a new `functions/api/scout/save-memory-storage.js` (or `save-memory-persist.js`) helper under `functions/api/scout/`, invoked by `save-memory.js` only after intake validation passes.
- Candidate reuse: the existing `js/postgres-client.js` `createMemory` boundary — the storage child should call the same client entry rather than opening a new DB client or a direct connection.
- Candidate reuse: the `live-rate-limit-storage-adapter.js` storage-boundary pattern for idempotency/audit key handling.
- The route's `persistence: 'gated'` response is the signal that the real write has NOT happened yet; the storage child is the only component allowed to flip a reviewed payload into a persisted memory.

This is a candidate only; the storage writer child owns the final path/helper decision.

## 5. Tree selection / treeId / draft-only — currently UNRESOLVED

The reviewed payload contract (#3386) accepts only the `reviewed` group with
`sourceLink` / `sourceLabel` / `memoryDraft` and optional safe bounded fields. It does
**not** carry a tree identifier. Therefore the following storage-handoff questions are
**UNRESOLVED** in the current convention and must be resolved by the storage writer child
before any write:

- Does Scout save into an explicit user-selected tree? If so, the client/UI must supply an explicit `treeId`, and the storage child must validate ownership of that tree.
- Is the saved item a draft-only memory in a default/holding area when no tree is selected? If so, the storage child must define that holding area and its later promotion path.
- Is the persisted item a LoveTree memory (with `memoryDraft`) as opposed to generated content? Yes — it is a user-reviewed memory draft, never promoted `generated` content.

The audit records `treeId` / tree-selection as an open prerequisite, not a decided field in the reviewed payload. Nothing here adds `treeId` to the reviewed payload contract.

## 6. Reviewed payload → LoveTree memory draft / write request transformation

The storage child translates the intake-validated `reviewed` object into the memory write
request using these rules:

- `sourceLink` → preserved verbatim as provenance (`source` / source link). Never rewritten, shortened, or replaced with generated text.
- `sourceLabel` → memory title / source label (safe bounded, normalized to the intake cap).
- `memoryDraft` → the LoveTree memory draft text (safe bounded, normalized to the intake cap).
- `summary` → optional safe bounded short summary, copied only when present and user-reviewed.
- `translatedSummary` → optional safe bounded short translated summary, copied only when present and user-reviewed.
- `fanContext` → optional safe bounded fan-relevant points, copied only when present and user-reviewed.
- `emotionTags` → optional safe bounded/sanitized emotion tags, copied only when present and user-reviewed.
- Every field outside this set is dropped. Forbidden fields are already rejected at intake and never reach the transformation step.

## 7. Storage allowed fields

The storage child persists only the #3365 allowed set:

- `sourceLink`
- `sourceLabel`
- `memoryDraft`
- optional safe bounded `summary`
- optional safe bounded `translatedSummary`
- optional safe bounded `fanContext`
- optional safe bounded `emotionTags`

## 8. Forbidden storage fields

The storage child must never persist any of the following. These are rejected at intake
(#3386 / #3395) and the storage child must additionally refuse them as a defense-in-depth
guard:

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
carried from #3365, #3386, and #3395.

## 9. Source link visibility preserved; full-content repost / rehost forbidden

- The original `sourceLink` is preserved verbatim in the saved memory and shown as provenance.
- The saved memory draft attributes the source and is marked as user-editable; no official endorsement is implied.
- Full-content repost and media rehost are forbidden: the storage child stores only short safe-bounded fields and the source link. It must never store or re-serve full scraped content, full article/post/transcript/lyrics/paywalled content, or copied image/video.

## 10. Idempotency posture

Save submissions must be idempotent. A repeated submission of the same reviewed payload must
not create duplicate memory drafts. The route defines an idempotency key from the reviewed
payload; the storage child enforces it, reusing the existing rate-limit storage adapter
boundary. This audit sets the prerequisite; the storage child implements it. The idempotency
key hash (SHA-256), not the raw key, is what may be stored for dedupe.

## 11. Duplicate prevention

Beyond idempotency, the storage child must de-duplicate by the same content+source+owner
signature within the target tree (once `treeId` is resolved). A second accepted save of an
identical reviewed payload for the same owner/tree returns the existing memory rather than
inserting a duplicate. The `duplicate_submission` safe error taxonomy code is reserved for
intake-level idempotency rejection; storage-level dedup is a separate, storage-owned guard.

## 12. Auth / ownership / tree selection prerequisites

- Auth: the save requires an owning context (the signed-in user saving into their own LoveTree) and must reuse the existing `live-auth-verifier-adapter.js` verification boundary. This audit states the prerequisite; it does not implement auth.
- Ownership: cross-user payload adoption is forbidden. The storage child must verify the requesting user owns the target tree (once `treeId` is resolved) before writing.
- Tree selection: unresolved per Section 5. The storage child must define how the target tree is selected/validated before any write.

## 13. Safe audit logging posture

- Audit logs record only safe metadata: a request id, the idempotency key hash, the owner id, the target tree id (once resolved), and the set of stored field names — never the field values.
- No raw/private value is ever written to an audit log: no token, cookie, auth header, API base URL, dashboard URL, DB row, request/response body, private log, or screenshot with private ID.
- Logs must be redaction-safe by construction; the storage child appends only the safe metadata enumerated above.

## 14. Safe error taxonomy and response copy

Intake/storage failures use the #3386 safe error taxonomy:

- `invalid_payload` — missing or malformed required field
- `unreviewed_generated_only` — generated-only save rejected
- `forbidden_content` — forbidden field detected (intake or storage defense-in-depth)
- `unsafe_source` — source blocked by #3365 boundary
- `duplicate_submission` — idempotency rejection
- `unauthorized` / `forbidden` — auth/ownership/tree-selection failure

Every error is safe copy: no raw backend output, no provider output, no stack trace, no
token/cookie/session/ID leakage. The response carries only a code, a safe human-readable
message, and the request id.

## 15. Non-prod verification plan (no real platform request / no production smoke)

Before any production path, a non-prod verification child must verify the handoff using:

- fixture reviewed payloads (no raw/private values)
- the existing `createMemory` client boundary in mock mode (no real `fetch`/provider call, no real DB write)
- the #3386 safe error taxonomy assertions
- idempotency replay and duplicate-prevention checks
- storage allowed-field / forbidden-field assertions against the transformed write request

No real platform request (no real YouTube / Instagram / X / Weverse / news request) and no
production smoke against live platforms. These require their own later-reviewed gates.

## 16. Future child split

When implementation begins later, it must be split into separate child issues, each gated and reviewed:

1. storage writer contract — defines the write request shape, allowed/forbidden fields, idempotency key, audit metadata
2. storage writer implementation — persists only allowed #3365 fields, enforces idempotency/duplicate prevention, reuses `createMemory` boundary
3. client / UI integration — wires tree selection / `treeId` and the review surface to the route
4. non-prod verification — verifies handoff without live platforms

Each child must re-accept this audit and the inherited #3365 / #3375 / #3379 / #3383 / #3386 /
#3387 / #3395 boundaries before code is written.

## 17. Explicit non-goals

- storage writer implementation
- memory insertion / persistence flip
- DB schema / migration
- client adapter / UI implementation
- provider / fetcher / crawler / scraper / LLM wiring
- Firebase / auth / runtime changes
- Social likes / comments work (#3188 / #3075 out of scope)
- production smoke against real platforms
- real platform requests

## 18. Cross-links

- Refs #3397
- Refs #1882
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
