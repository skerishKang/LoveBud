# LoveBud Scout MVP Save-Memory Target Tree Selection Contract

## 1. Purpose

This document defines the **contract** for how a Scout save-memory reviewed payload is
assigned to a target LoveTree — the target tree selection contract. It is the next step
after the save-memory storage writer contract (#3402 / #3403): the writer contract fixed the
writer/helper shape and required an explicit `treeId` once resolved; this contract fixes the
selection envelope, the owner-identity source, the ownership validation, the safe failure
states, and the handoff into `persistReviewedScoutMemoryDraft(...)`.

It is a contract and documentation document, not an implementation. It contains no target-tree
UI, no storage writer runtime, no `persistReviewedScoutMemoryDraft` body, no memory insertion,
no DB schema/migration, no client adapter, no fetcher, no crawler, no scraper, no provider
wiring, no Firebase/auth/runtime change, and no production smoke. The selection logic is
implemented only by later implementation children that re-accept this contract.

This contract is a child of the parent Scout product issue (#1882) and inherits the
link-source safety boundary (#3365), the manual link-to-memory draft flow contract (#3375),
the save-to-memory payload contract (#3379 / #3380), the reviewed payload route intake
contract (#3386 / #3387), the reviewed payload route intake guard (#3395), the reviewed
payload route readiness audit (#3389 / #3390), the save-memory storage handoff boundary audit
(#3397 / #3399), and the save-memory storage writer contract (#3402 / #3403). It must be read
together with those documents.

## 2. Inherited boundaries

This contract is subordinate to:

- the link-source safety boundary (#3365) — source/content/storage/attribution rules
- the manual link-to-memory draft flow contract (#3375) — edit-before-save
- the save-to-memory payload contract (#3379 / #3380) — payload shape, generated-vs-reviewed, required/optional/forbidden fields
- the reviewed payload route intake contract (#3386 / #3387) — reviewed-only acceptance, required/optional/forbidden fields, safe error taxonomy, idempotency, storage handoff
- the reviewed payload route intake guard (#3395) — `FORBIDDEN_NAMES` rejection at intake
- the reviewed payload route readiness audit (#3389 / #3390) — route location, shell reuse, auth/storage/idempotency prerequisites
- the save-memory storage handoff boundary audit (#3397 / #3399) — storage allowed/forbidden fields, treeId UNRESOLVED posture, transformation, idempotency/duplicate prevention, safe audit logging, safe error taxonomy
- the save-memory storage writer contract (#3402 / #3403) — writer/helper shape, input/output DTO, ownership prerequisite, idempotency/duplicate prevention, future handoff

If this contract disagrees with #3365, #3375, #3379, #3383, or #3386, those documents win.

## 3. Target tree selection options

The contract defines the selection envelope. Three option shapes are in scope:

- **Explicit user-selected `treeId` (required at the implementation boundary)**: the client/UI supplies an explicit target `treeId`; the route validates ownership server-side before any write. This is the primary, repository-consistent option.
- **Draft-only / holding posture**: when no `treeId` is supplied, the save is held in a draft-only / holding posture and is NOT persisted as a memory. This matches the `treeId` UNRESOLVED / draft-only posture already fixed by #3397 / #3399 and #3402.
- **Repository-consistent alternative**: if a future repository convention defines a default/last-used tree binding, it must still resolve to an explicit owned `treeId` and re-run ownership validation. No implicit, unverified default may bypass ownership checks.

### Final resolution status

This contract defines the selection envelope and the ownership/validation rules, but the
**final binding of "which tree a save lands in when the user has not explicitly chosen" is
UNRESOLVED / deferred** to the target-tree UI/client selection integration child (#3406
future gate 1). The reviewed payload contract (#3386) does not carry `treeId`, so the
selection mechanism (how the client supplies or confirms `treeId`) is intentionally left to
that child. Until then, the only safe posture is explicit `treeId` (when provided and owned)
or draft-only holding (when not). The contract does **not** invent or guess a tree.

## 4. Reviewed save payload fields vs server-resolved context

The selection step separates two sources of truth:

- **Reviewed save payload** (carried from intake, never expanded): `sourceLink`, `sourceLabel`, `memoryDraft`, optional bounded `summary`, `translatedSummary`, `fanContext`, `emotionTags`. The selection contract does NOT add any owner/user field to this payload.
- **Server-resolved context** (never from the client payload): the verified owner/user identity, and — once resolved — the target `treeId`. The selection step reads `treeId` only from the verified client/UI selection input, validates it, and never derives identity from the payload.

## 5. Owner / user identity

- The owner/user identity is taken **ONLY** from the verified auth context (the signed-in user), reusing the existing `live-auth-verifier-adapter.js` verification boundary.
- The selection step must **never** read an owner/user id from the client payload. A client-supplied owner/user id is rejected/ignored; the server-resolved identity always wins.
- This contract states the prerequisite; it does **not** implement auth.

## 6. Ownership validation

- The target tree must be owned by the requesting (verified) user. Cross-user save is forbidden.
- Before any write handoff, the selection step verifies: the supplied `treeId` exists, is owned by the requester, and is in a writable state. A `treeId` belonging to another user is rejected.
- Ownership validation is a server-side check against the resolved identity; it cannot be satisfied by any client claim.

## 7. Safe failure states

The selection step returns safe, categorized failure states (no raw/private detail):

- `missing_tree_selection` — no `treeId` supplied and no holding posture is acceptable for this request
- `invalid_tree_id` — `treeId` is malformed / not a valid identifier
- `tree_not_owned` — target tree exists but is not owned by the requester (`unauthorized` / `forbidden`)
- `tree_unavailable` — target tree not found, soft-deleted, closed, or otherwise not writable
- `unresolved_target_selection` — selection is still UNRESOLVED (draft-only holding; no write)

Each failure is safe copy: no raw backend output, no token/cookie/session/ID leakage. The
response carries only a code, a safe human-readable message, and the request id.

## 8. Output / result posture

- **No raw payload echo**: the selection result must never include the reviewed payload body, forbidden fields, tokens, cookies, auth headers, or any raw/private value.
- `requestId`: a safe request correlation id is returned.
- **No persistence flip**: this contract performs no write. The current route continues to return `persistence: 'gated'`.
- The selection result object carries only: `requestId`, the resolved/validated `treeId` (when explicitly selected and owned) or an explicit `selection: 'draft-only'` / `selection: 'unresolved'` marker, and safe status — never raw values.

## 9. Future storage writer handoff

The selection result is passed to the future storage writer as a resolved, validated context:

- When an explicit `treeId` is supplied and ownership-validated, the result hands `{ treeId, ownerId, reviewed }` to `persistReviewedScoutMemoryDraft(...)`.
- When the target tree is **UNRESOLVED** (no `treeId`, draft-only holding), the writer must **NOT** write. The writer records the unresolved posture and defers, consistent with #3402 §5 / §8.
- The writer never re-derives identity or re-selects a tree; it trusts the validated selection context.

## 10. Safe audit logging

The selection step appends only redaction-safe audit metadata:

- request id
- owner id (server-resolved, never client-supplied)
- target tree id — **only if explicitly selected and resolved**
- selection posture (`draft-only` / `unresolved` / `selected`) — never the field values
- SHA-256 idempotency key hash (when present)

It must **never** write: raw idempotency key, request/response body, token, cookie, auth
header, API base URL, dashboard URL, DB row, or screenshot with private ID. Logs are
redaction-safe by construction.

## 11. Safe error / result taxonomy

Selection failures reuse and extend the #3386 / #3399 / #3402 safe error taxonomy:

- `invalid_payload` — missing or malformed required field
- `unreviewed_generated_only` — generated-only save rejected
- `forbidden_content` — forbidden field detected (intake or writer defense-in-depth)
- `unsafe_source` — source blocked by #3365 boundary
- `duplicate_submission` — idempotency rejection
- `unauthorized` / `forbidden` — auth/ownership failure (`tree_not_owned`)
- `missing_tree_selection` — no `treeId` and no holding posture
- `invalid_tree_id` — malformed `treeId`
- `tree_unavailable` — target tree not writable
- `unresolved_target_selection` — selection still unresolved (draft-only, no write)

Every result/error is safe copy: no raw backend output, no provider output, no stack trace,
no token/cookie/session/ID leakage. The response carries only a code, a safe human-readable
message, and the request id.

## 12. Future implementation gates

When implementation begins later, it must be gated and reviewed in order:

1. target-tree UI / client selection integration — wires how the user selects/confirms `treeId` and the review surface to the route
2. ownership validation helper contract / implementation — verifies `treeId` exists and is owned by the requester
3. storage writer implementation — implements `persistReviewedScoutMemoryDraft(...)`, consumes the validated selection context
4. non-prod verification — verifies selection + writer without live platforms (fixtures, mock client, #3386 taxonomy assertions, ownership replay)
5. production activation — only after a separate, explicit production-activation approval

Each gate must re-accept this contract and the inherited #3365 / #3375 / #3379 / #3383 /
#3386 / #3387 / #3395 / #3397 / #3399 / #3402 boundaries before code is written.

## 13. Explicit non-goals

- target-tree UI implementation
- storage writer runtime implementation (no `persistReviewedScoutMemoryDraft` body)
- memory insertion / persistence flip
- DB schema / migration
- client adapter implementation
- provider / fetcher / crawler / scraper / LLM wiring
- Firebase / auth / runtime changes
- Social likes / comments work (#3188 / #3075 out of scope)
- production smoke against real platforms
- real platform requests

## 14. Cross-links

- Refs #3406
- Refs #1882
- Refs #3402
- Refs #3403
- Refs #3397
- Refs #3399
- Refs #3386
- Refs #3387
- Refs #3379
- Refs #3380
- Refs #3375
- Refs #3365
- Refs #3188
- Refs #3075
