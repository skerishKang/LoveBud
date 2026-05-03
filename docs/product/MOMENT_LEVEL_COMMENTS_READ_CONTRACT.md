# Moment-level comments read contract

**Status:** Product/API contract planning  
**Owner:** CTO / Product / Engineering  
**Related issue:** #754  
**Parent model:** `TREE_MOMENT_SOCIAL_MODEL.md`

This document defines the first read contract for comments attached to a selected public LoveTree moment.

This is not an implementation PR. It does not add comment storage, API routes, UI surfaces, database schema, moderation tooling, authenticated writing, reactions, or browser behavior. It narrows the product/API contract that future implementation PRs must preserve.

---

## 1. Contract purpose

Moment-level comments represent discussion about one selected moment/node inside a public LoveTree.

They are separate from tree-level comments. A moment-level comment should not be returned as whole-tree discussion unless a separate aggregate view is explicitly designed.

The read contract must answer five questions before implementation:

1. Which selected moment is the comment attached to?
2. Is the parent tree publicly readable?
3. Is the selected moment publicly readable under the current policy?
4. What safe response shape should a public reader receive?
5. What should the UI show when no readable comments exist for the selected moment?

---

## 2. Scope

### In scope

- Selected-moment comment read semantics.
- Parent tree boundary.
- Target moment public-read boundary.
- Logged-out read direction.
- Hidden/deleted/moderated comment exclusion.
- Safe response shape planning.
- Empty-state behavior for moments without comments.
- Verification requirements for a future runtime PR.

### Out of scope

- Tree-level comment reads.
- Authenticated comment writing.
- Anonymous comment writing.
- Reactions and social counts.
- Moderation/reporting UI.
- Admin tooling.
- Browse card redesign.
- My Trees card cleanup.
- Public viewer placeholder UI implementation.
- Database migration.
- Runtime route implementation.
- PR #7 / prototype / reference / demo / variant paths.

---

## 3. Target scope definition

A moment-level comment has this logical target:

```text
target_scope: moment
target_tree: required
target_moment: required
```

The contract must not infer moment-level comments from tree-level records. If a comment has no target moment, it belongs to the tree-level contract and should not appear in a selected-moment comment list.

The parent tree reference is required even if the target moment reference exists. Public read decisions must not rely on a moment identifier alone.

---

## 4. Public read eligibility

A moment-level comment is publicly readable only when all required checks pass.

Required public read checks:

```text
parent tree visibility: public
target moment public-read state: public
comment scope: moment
comment target tree: matches requested tree
comment target moment: matches requested moment
comment status: visible
comment moderation state: not hidden / not removed
```

If the parent tree is private, missing, deleted, or otherwise not publicly readable, public moment-level comments must not be returned.

If the target moment is missing, deleted, private-only, not part of the requested tree, or otherwise not publicly readable, public moment-level comments must not be returned.

If the comment itself is hidden, deleted, removed, blocked, or moderation-pending under future policy, it must not appear in public read results.

---

## 5. Logged-out behavior

Baseline direction:

- Logged-out users may read visible moment-level comments only when both the parent tree and selected moment are publicly readable.
- Logged-out users must not write comments in the first write-enabled version unless a separate anti-abuse plan is approved.
- Logged-out reads should receive only the safe public response shape.

If future policy changes this, it should be recorded in a separate PR or issue before implementation.

---

## 6. Authenticated and owner reads

Authenticated viewers may receive the same public response shape unless a separate owner/private contract is defined.

Tree owners may eventually need additional moderation context for comments on moments inside their trees, but that should not be included in the first public read endpoint unless explicitly approved.

Keep the first read contract simple:

```text
public moment viewer: public-safe comments only
owner moderation view: future separate contract
admin review view: future separate contract
```

Do not overload the public read endpoint with moderation-only fields.

---

## 7. Safe response shape

The exact storage model is not defined here. A future implementation may use a table, collection, or derived service. The public response should preserve this logical shape:

```text
comment:
- id presence: PRESENT
- target_scope: moment
- target_tree presence: PRESENT
- target_moment presence: PRESENT
- body text: PRESENT
- author display label: PRESENT_OR_ANONYMOUS_LABEL
- created timestamp: PRESENT
- edited marker: PRESENT_IF_SUPPORTED
- moderation visible state: VISIBLE_ONLY
```

The response should not expose private author/account metadata, internal ownership fields, raw database rows, or moderation internals.

Recommended public response rules:

- return comments in deterministic order;
- default order should be oldest-first or newest-first, explicitly documented before launch;
- include a limit and pagination/cursor plan before large reads are enabled;
- return safe empty arrays for no readable comments;
- distinguish `NOT_FOUND_OR_PRIVATE` from readable empty comment state only when product policy allows that distinction.

---

## 8. Empty state

When a public moment has no readable moment-level comments, the UI should not imply failure.

Suggested safe states:

```text
moment comments loaded: YES
moment comment count: 0
empty state: PRESENT
error state: NO
```

Product copy direction can remain gentle and expectation-setting, for example:

- `아직 이 순간에 남겨진 이야기가 없어요`
- `이 순간의 첫 이야기를 기다리고 있어요`

Do not show write prompts until authenticated writing is intentionally enabled.

---

## 9. Error and unavailable states

The read path should separate these conditions:

```text
PUBLIC_MOMENT_WITH_NO_COMMENTS
PUBLIC_MOMENT_COMMENTS_LOAD_FAILED
TREE_NOT_PUBLIC_OR_NOT_FOUND
MOMENT_NOT_PUBLIC_OR_NOT_FOUND
COMMENTS_FEATURE_NOT_READY
```

A missing comments feature should not look like an empty comment list if the product is not actually loading comments yet. During placeholder phases, the UI should use an explicit feature-not-ready or quiet empty-state treatment depending on the release plan.

---

## 10. Pagination and limits

A future read endpoint should not return unbounded comment lists.

Recommended first contract:

```text
default limit: small page size
maximum limit: bounded
pagination: cursor or created-time boundary
order: documented and deterministic
```

The exact values should be chosen by the implementation PR after current backend/data constraints are inspected.

---

## 11. Verification requirements for future implementation

Any runtime implementation PR must verify:

- moment-level and tree-level scopes remain separate;
- logged-out moment comment reads work only when the parent tree is public;
- logged-out moment comment reads work only when the target moment is publicly readable;
- private parent trees do not expose moment-level comments publicly;
- private or missing target moments do not expose moment-level comments publicly;
- hidden/deleted/moderated comments are excluded from public read results;
- empty public moments show an empty state rather than an error;
- load failures show a recoverable safe state;
- response shape uses public-safe fields only;
- pagination/limit behavior is bounded;
- desktop and mobile UI behavior is verified if a UI surface is included;
- Auth/API behavior uses a Cloudflare Preview or fixed test slot with deployed SHA match.

Reports must use safe status labels and aggregate counts only.

---

## 12. Safe reporting template

Use this template for future #754 implementation or verification reports:

```text
Moment-level comments read contract:
- parent tree public read checked: YES / NO / NOT_VERIFIED
- target moment public read checked: YES / NO / NOT_VERIFIED
- moment-level scope only: YES / NO / NOT_VERIFIED
- tree-level records excluded: YES / NO / NOT_VERIFIED
- hidden/deleted/moderated excluded: YES / NO / NOT_VERIFIED
- logged-out read behavior: PASS / FAIL / NOT_VERIFIED
- authenticated public read behavior: PASS / FAIL / NOT_VERIFIED
- owner moderation fields exposed publicly: NO / YES / NOT_VERIFIED
- empty state: PRESENT / MISSING / NOT_APPLICABLE
- API/runtime verification target: FIXED_SLOT / CLOUDFLARE_PREVIEW / NOT_REQUIRED / NOT_VERIFIED
- deployed SHA match: YES / NO / NOT_VERIFIED
- restricted values exposed: NO
```

---

## 13. Relationship to other tracks

This contract should be implemented or documented before:

- authenticated moment-level comment writing;
- moment-level social counts;
- moderation/reporting behavior;
- public viewer selected-moment social UI that implies loaded comments.

Related follow-up tracks:

- #753 — tree-level comments read contract;
- #755 — public viewer social placeholders;
- #756 — authenticated comment write path;
- #757 — scoped social counts model;
- #758 — social moderation baseline.

---

## 14. Current disposition

This document satisfies the first contract layer for #754. It defines moment-level read scope, parent tree boundary, target moment boundary, logged-out behavior, safe response shape, empty/error states, pagination direction, and future verification requirements.

#754 should remain open until this contract is reviewed and any needed follow-up implementation or explicit deferral is recorded.
