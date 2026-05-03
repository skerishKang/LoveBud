# Tree-level comments read contract

**Status:** Product/API contract planning  
**Owner:** CTO / Product / Engineering  
**Related issue:** #753  
**Parent model:** `TREE_MOMENT_SOCIAL_MODEL.md`

This document defines the first read contract for comments attached to a whole public LoveTree.

This is not an implementation PR. It does not add comment storage, API routes, UI surfaces, database schema, moderation tooling, authenticated writing, reactions, or browser behavior. It narrows the product/API contract that future implementation PRs must preserve.

---

## 1. Contract purpose

Tree-level comments represent discussion about the full public LoveTree.

They are separate from moment-level comments. A tree-level comment should not be attached to a specific node, memory, source video, scene, memo, or emotion tag.

The read contract must answer four questions before implementation:

1. Which comments are eligible to be read with the tree?
2. Which users may read them?
3. What safe response shape should a public reader receive?
4. What should the UI show when no readable comments exist?

---

## 2. Scope

### In scope

- Whole-tree comment read semantics.
- Public read eligibility.
- Logged-out read direction.
- Parent tree visibility guard.
- Hidden/deleted/moderated comment exclusion.
- Safe response shape planning.
- Empty-state behavior for public trees without comments.
- Verification requirements for a future runtime PR.

### Out of scope

- Moment-level comment reads.
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

A tree-level comment has this logical target:

```text
target_scope: tree
target_tree: required
target_moment: absent
```

The contract must not infer tree-level comments from moment-level records. If a comment has a target moment, it belongs to the moment-level contract and should not be returned as a direct tree-level comment unless a separate aggregate view is explicitly designed.

---

## 4. Public read eligibility

A tree-level comment is publicly readable only when all required checks pass.

Required public read checks:

```text
parent tree visibility: public
comment scope: tree
comment status: visible
comment target tree: matches requested tree
comment moderation state: not hidden / not removed
```

If the parent tree is private, missing, deleted, or otherwise not publicly readable, public tree-level comments must not be returned.

If the comment itself is hidden, deleted, removed, blocked, or moderation-pending under future policy, it must not appear in public read results.

---

## 5. Logged-out behavior

Baseline direction:

- Logged-out users may read visible tree-level comments for publicly readable trees.
- Logged-out users must not write comments in the first write-enabled version unless a separate anti-abuse plan is approved.
- Logged-out reads should receive only the safe public response shape.

If future policy changes this, it should be recorded in a separate PR or issue before implementation.

---

## 6. Authenticated and owner reads

Authenticated viewers may receive the same public response shape unless a separate owner/private contract is defined.

Tree owners may eventually need additional moderation context, but that should not be included in the first public read endpoint unless explicitly approved.

Keep the first read contract simple:

```text
public tree viewer: public-safe comments only
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
- target_scope: tree
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

When a public tree has no readable tree-level comments, the UI should not imply failure.

Suggested safe states:

```text
tree comments loaded: YES
tree comment count: 0
empty state: PRESENT
error state: NO
```

Product copy direction can remain gentle and expectation-setting, for example:

- `아직 이 트리에 남겨진 이야기가 없어요`
- `첫 이야기를 기다리고 있어요`

Do not show write prompts until authenticated writing is intentionally enabled.

---

## 9. Error and unavailable states

The read path should separate these conditions:

```text
PUBLIC_TREE_WITH_NO_COMMENTS
PUBLIC_TREE_COMMENTS_LOAD_FAILED
TREE_NOT_PUBLIC_OR_NOT_FOUND
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

- tree-level and moment-level scopes remain separate;
- logged-out public tree comment reads work only for public parent trees;
- private parent trees do not expose tree-level comments publicly;
- hidden/deleted/moderated comments are excluded from public read results;
- empty public trees show an empty state rather than an error;
- load failures show a recoverable safe state;
- response shape uses public-safe fields only;
- pagination/limit behavior is bounded;
- desktop and mobile UI behavior is verified if a UI surface is included;
- Auth/API behavior uses a Cloudflare Preview or fixed test slot with deployed SHA match.

Reports must use safe status labels and aggregate counts only.

---

## 12. Safe reporting template

Use this template for future #753 implementation or verification reports:

```text
Tree-level comments read contract:
- parent tree public read checked: YES / NO / NOT_VERIFIED
- tree-level scope only: YES / NO / NOT_VERIFIED
- moment-level records excluded: YES / NO / NOT_VERIFIED
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

- authenticated tree-level comment writing;
- tree-level social counts;
- moderation/reporting behavior;
- public viewer social UI that implies loaded comments.

Related follow-up tracks:

- #754 — moment-level comments read contract;
- #755 — public viewer social placeholders;
- #756 — authenticated comment write path;
- #757 — scoped social counts model;
- #758 — social moderation baseline.

---

## 14. Current disposition

This document satisfies the first contract layer for #753. It defines tree-level read scope, public read eligibility, logged-out behavior, safe response shape, empty/error states, pagination direction, and future verification requirements.

#753 should remain open until this contract is reviewed and any needed follow-up implementation or explicit deferral is recorded.
