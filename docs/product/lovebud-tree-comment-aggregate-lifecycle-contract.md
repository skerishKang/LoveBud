# Tree Comment Aggregate Lifecycle Contract

- **Issue:** #3254
- **Parent:** Refs #3188
- **Prior audit:** Refs #3252
- **Related planning:** Refs #622, Refs #753
- **Reference:** Refs #1882
- **Baseline SHA:** `44de1cd53273c4c9654a52f38eda6fb858a853da`
- **Classification:** documentation-only contract; no production data, credentials, schema, API, UI, or runtime change

---

## 1. Metric meaning

A future tree `commentCount` means **only comments directly scoped to the whole tree**.

This metric must never silently mean the sum of comments on all moments. The two scopes are distinct by product contract:

- **tree comment:** a comment whose target is the tree as a whole, discussing the overall emotional path, the creator's curation, the artist or story represented by the tree, or the viewer's overall response (per `TREE_MOMENT_SOCIAL_MODEL.md` §2).
- **moment comment:** a comment whose target is a specific moment/node within that tree, discussing a specific media source, scene, lyric, image, memo, or emotion tag.

A future product decision would be required to expose any "total comments across moments" metric. If such a metric is approved, it must carry a distinct name and label — for example `totalMomentCommentCount` — and must not reuse the `commentCount` field name or any label that could be confused with tree-scoped comments.

Current card fallback zeros (produced by `|| 0` patterns in `js/my-trees/my-trees-ui.js` and `js/search/search-card-renderer.js`) are not canonical tree comment counts. As established by the count provenance audit (#3252), `commentCount` has no verified canonical runtime source on any path; the Browse card `0` and My Trees card `0` are both `UI_DEFAULT` synthetic values.

---

## 2. Future logical record boundary

This section defines only the logical contract for a tree-scoped comment record. It does not define a concrete schema migration, database table, or column.

| Logical field | Requirement |
|---|---|
| Comment identity | Unique identifier for the tree-scoped comment |
| Parent `tree_id` | Required — the tree this comment belongs to |
| `memory_id` target | Absent — a tree-scoped comment must not target a specific moment |
| Author reference | Internal only — must not appear in public aggregate or count payloads |
| Body | Text content of the comment |
| Created timestamp | Time of creation |
| Updated timestamp | Time of last edit, if edits are supported |
| Moderation/deletion state | Current lifecycle state determining visibility and count eligibility |

Tree comments remain distinct from the existing moment-scoped `comments.memory_id` model. The existing `comments` table is keyed by `memory_id` (foreign key to `memories.id`); no `tree_id`-keyed comment record exists. A tree-scoped comment record must not be stored in or derived from the moment-scoped `comments` table. Any future storage must preserve this scope separation as defined in `TREE_MOMENT_SOCIAL_MODEL.md` §4 and `TREE_LEVEL_COMMENTS_READ_CONTRACT.md` §3.

The author reference is stored internally for write authorization, ownership checks, and moderation, but must never be included in public count payloads, public aggregate responses, or any payload visible to non-owners. This follows the same boundary established in `TREE_MOMENT_SOCIAL_MODEL.md` §7 and the boundary audit (#3252): public output must not expose author identifiers, moderation reasons, raw internal states, deleted records, request keys, or raw payloads.

---

## 3. Aggregate eligibility

A comment contributes to a future tree `commentCount` aggregate if and only if it satisfies the following logical predicate:

```
eligible_for_aggregate(comment) =
    comment.scope = tree
    AND comment.tree_id IS NOT NULL
    AND comment.state = VISIBLE
    AND comment.moderation_status NOT IN (HIDDEN, REMOVED, PENDING_REVIEW)
    AND comment.deleted_at IS NULL
    AND comment.write_status = ACCEPTED
    AND comment.deduplication_key IS UNIQUE among accepted comments for this tree
```

Only a tree-scoped comment in an authoritative visible state may count.

### Treatment of specific lifecycle states

| State or event | Aggregate effect | Rationale |
|---|---|---|
| **Newly created visible comment** | Increment once, after write is confirmed `ACCEPTED` | Only confirmed writes produce countable state |
| **Author deletion** | Decrement once, if previously counted | Author removes their own comment; previously counted state transitions out of eligibility |
| **Owner moderation hide/remove** | Decrement once, if previously counted | Moderation action removes the comment from public visibility; previously counted state transitions out of eligibility |
| **Moderation reversal/unhide** | Increment once, if returning to counted state and not otherwise ineligible | Comment returns to visible state; increment only if it was previously decremented |
| **Restore** (of previously deleted/hidden comment) | Increment once, only if returning to counted state | Symmetric with the decrement that removed it |
| **Failed or rejected write** | No increment | Never entered an eligible state; no aggregate effect |
| **Duplicate/retried write** | No second transition | Same logical comment must not be counted twice; deduplication ensures one increment per unique accepted comment |
| **Unknown or inconsistent state** | No change until authoritative reconciliation | An unknown state must not produce a count transition; reconciliation must resolve the inconsistency before any further aggregate change |

Do not use a default-zero aggregate as evidence that the metric is available. A zero derived from an absent or unverified source is not an authoritative count. This follows the finding in the count provenance audit (#3252 §5.4): the `|| 0` pattern conflates unavailable with genuine zero, and tree `commentCount` must not repeat that defect.

---

## 4. Lifecycle effects

### Transition table

| Transition | Aggregate effect | Guard |
|---|---|---|
| Create visible tree comment | Increment once | Only after write confirmed `ACCEPTED` and deduplication verified |
| Delete (author) | Decrement once | Only if previously counted |
| Hide/remove (owner moderation) | Decrement once | Only if previously counted |
| Unhide (moderation reversal) | Increment once | Only if returning to counted state |
| Restore (of deleted/hidden comment) | Increment once | Only if returning to counted state |
| Repeated request or retry | No second transition | Same deduplication key must not produce duplicate increment |
| Reconciliation/backfill | Recompute from authoritative tree-comment records | Must not increment from client activity; must recompute the full aggregate from the set of eligible records |
| Invalid or stale transition | No change | Until authoritative reconciliation resolves the inconsistency |

The aggregate must never be negative. If any decrement would produce a negative value, the aggregate must be clamped to zero and the inconsistency must be flagged for reconciliation (see §6 `RECONCILIATION_REQUIRED`).

---

## 5. Visibility and public-read boundary

A public tree comment count may be exposed only when the parent tree is public. This follows the visibility boundary established in `TREE_MOMENT_SOCIAL_MODEL.md` §7 and `TREE_LEVEL_COMMENTS_READ_CONTRACT.md` §4.

If a tree becomes private:

- Public comment reads must be unavailable or blocked.
- Public comment counts must be unavailable or blocked.
- The contract must not prescribe deleting internal records or decrementing an internal aggregate solely because visibility changes. Internal records and the internal aggregate remain intact; only public exposure is gated.

Public responses may expose only:

- A non-negative aggregate integer.
- Safe availability state (e.g., the count is available, or the feature is not ready).

Public output must not expose:

- Author identifiers or account metadata.
- Moderation reasons or internal moderation state labels.
- Raw internal states, state machine labels, or transition logs.
- Deleted records or their content.
- Request keys, idempotency keys, or submission identifiers.
- Raw payloads, database rows, or internal field names.

This boundary aligns with the existing moment-level public read contract, where public read checks require `parent tree visibility: public` and `comment status: visible` (`TREE_LEVEL_COMMENTS_READ_CONTRACT.md` §4), and with the boundary audit finding that owner_id must not reach public output (#3252 §3.1).

---

## 6. Authoritativeness and reconciliation

Three conceptual states govern the trustworthiness of a future tree comment aggregate:

### `AUTHORITATIVE`

The count is derived from known valid tree-comment lifecycle state. All contributing records have been verified against the eligibility predicate (§3). The aggregate reflects only comments in `VISIBLE` state with `ACCEPTED` write status, no active moderation or deletion, and verified deduplication.

### `UNAVAILABLE`

No approved tree-comment lifecycle implementation exists, or public visibility does not permit exposure. This is the correct state for:

- Any path where tree-level comment storage does not exist.
- Any path where the parent tree is not public.
- Any path where the comment feature is not yet implemented or enabled.

`UNAVAILABLE` must not be represented as a zero count. A zero and an unavailable state are semantically different. The count provenance audit (#3252 §5.4) identified the conflation of these two states as a defect in the current `|| 0` fallback pattern.

### `RECONCILIATION_REQUIRED`

An inconsistency is detected — for example, the aggregate does not match a recount of eligible records, or a transition was applied out of order. No count should be newly represented as trustworthy until recomputed from authoritative records.

Reconciliation must recompute the full aggregate from the set of eligible tree-comment records, not by applying corrective increments or decrements. After reconciliation, the state returns to `AUTHORITATIVE` if the recomputed count is consistent, or remains `RECONCILIATION_REQUIRED` if inconsistencies persist.

This contract does not define a real API response shape or endpoint. These three states are conceptual labels for future implementation planning.

---

## 7. Explicit non-goals

This contract does not add:

- Database table or column.
- `comment_count` column in `tree_social_counts` or any other table.
- Schema migration.
- Public or authenticated API route.
- Comment write or read implementation.
- Card or viewer UI.
- Browse/My Trees count change.
- Test that freezes absence of implementation.
- Share-count work.
- Any #3075 moment-level feature change.

The existing moment-level comment implementation (`comments.memory_id` model, `public-viewer-authenticated-comment-composer.js`, `POST /api/memories/:memoryId/comments`, idempotency-key mechanism, rate limiting, `SAFE_ACTIONS` audit logging) remains outside the scope of this contract and must not be modified as a result of this document.

---

## 8. Next implementation gate

A future runtime slice for tree-scoped comments may not start until all of the following are separately approved:

1. **Tree-scoped record model** — logical fields, storage boundary, and scope separation from the moment-scoped `comments.memory_id` model.
2. **Write authorization and moderation policy** — who may create a tree comment, under what conditions, and what moderation actions the tree owner or system may apply.
3. **Idempotency, rate-limit, and audit policy** — deduplication semantics, rate limits on creation, and audit logging comparable to the existing moment-level `SAFE_ACTIONS` framework.
4. **Authoritative aggregate maintenance strategy** — how the count is maintained (increment/decrement on transition, periodic reconciliation, or recomputation on read), how inconsistencies are detected and resolved, and how the three authoritativeness states (§6) are managed.
5. **Public visibility/read contract** — public read eligibility rules, safe response shape, empty and error states, pagination, and the visibility gate that blocks public exposure when the parent tree is private.
6. **Focused runtime test plan** — tests that verify scope separation, visibility boundaries, aggregate correctness, transition idempotency, and non-negative invariant before any runtime code is merged.

This contract does not recommend a specific runtime slice, endpoint, migration, or UI change. It is a readiness prerequisite: the above six items must each receive separate approval before implementation begins.

---

*Contract complete. No runtime files, test files, configuration files, or schema artifacts were created or modified.*
