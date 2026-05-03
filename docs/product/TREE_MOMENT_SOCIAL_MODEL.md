# Tree and moment social model

**Status:** Product and data model planning  
**Owner:** CTO / Product  
**Related issue:** #622

This document defines the first product model for public LoveTree social spaces at two scopes: tree-level discussion and moment-level discussion.

This is not an implementation PR. It does not add comments, reactions, API routes, database tables, UI surfaces, moderation tooling, or browser behavior. It records the product, permission, and data-model boundaries that future implementation PRs must follow.

---

## 1. Product intent

Public LoveTrees should eventually support social response without turning the product into a generic feed.

The intended model is:

1. **Tree-level discussion** for the full public LoveTree.
2. **Moment-level discussion** for a specific public moment/node inside that tree.

The two scopes must remain distinct. A response to the whole emotional path is not the same as a response to one moment. Future UI can place these surfaces in different panels, drawers, sections, or pages, but implementation must preserve the scope distinction.

---

## 2. Scope definitions

### Tree-level social scope

Tree-level comments/reactions belong to the public LoveTree as a whole.

They may discuss:

- the overall emotional path;
- the creator's curation;
- the artist/story represented by the tree;
- the general feeling of the full public tree;
- the viewer's overall response.

Tree-level social data should be keyed to the tree as a whole and should not be attached to a specific memory/moment.

### Moment-level social scope

Moment-level comments/reactions belong to one selected moment/node.

They may discuss:

- a specific media source;
- a specific scene, lyric, image, or memory;
- the memo or emotion tag attached to that moment;
- a viewer's response to that exact point in the tree.

Moment-level social data should be keyed to the moment/memory and must remain associated with its parent tree boundary.

---

## 3. Permission model direction

Baseline direction for v0.1 planning:

- Logged-out users may read public comments only if the parent tree is public and the target moment is publicly readable.
- Logged-out users should not write comments in the first write-enabled version unless a separate anti-abuse plan is approved.
- Authenticated users may write comments on public trees/moments if product policy permits.
- Tree owners may moderate comments on their own public trees.
- Comment authors may delete or edit their own comments, subject to future policy.
- Private trees should not expose tree-level or moment-level social surfaces to anonymous users.
- If a tree changes from public to private, public comment reads should be blocked or hidden according to the parent tree visibility boundary.
- If a moment is deleted or becomes non-public, moment-level comments should no longer be publicly readable.

Any write-enabled implementation must enforce permissions on the server/runtime boundary. Client-only hiding is not sufficient.

---

## 4. Data model direction

A future implementation may use separate tables/collections or a shared polymorphic model. The product contract should preserve these logical fields regardless of storage shape.

Required logical fields for both scopes:

- comment identifier;
- target scope: `tree` or `moment`;
- target tree reference;
- target moment reference only for moment-level comments;
- author reference;
- body text;
- created timestamp;
- updated timestamp if edits are supported;
- deleted or moderated state;
- visibility/read state derived from parent tree and target moment policy.

Recommended separation:

```text
Tree comment:
- target_scope: tree
- target_tree: required
- target_moment: absent

Moment comment:
- target_scope: moment
- target_tree: required
- target_moment: required
```

Do not rely on a moment identifier alone for public read decisions. Moment-level reads must also verify the parent tree boundary.

---

## 5. Reactions and counts

Reactions should also preserve scope.

Tree-level reaction counts answer:

- how viewers responded to this whole tree.

Moment-level reaction counts answer:

- how viewers responded to this particular moment.

Do not merge these counts into one ambiguous popularity number without a separate Browse/popular semantics decision.

Future count surfaces should specify whether a number is:

- tree comments;
- moment comments;
- total comments across all moments;
- tree reactions;
- moment reactions;
- total reactions across all moments.

---

## 6. Moderation and abuse baseline

A first implementation must not add public write comments without a moderation baseline.

Minimum moderation questions:

- Can the tree owner hide or delete comments?
- Can a comment author delete their own comment?
- Is edit history needed?
- Is report/flag required before launch?
- Are blocked users or abuse controls needed?
- Are rate limits needed?
- Are profanity/spam filters needed?
- What audit trail is retained for deleted/moderated comments?

If the answer is unknown, ship read-only placeholders or read-only seeded comments first rather than public write.

---

## 7. Public/private visibility boundaries

Social data must inherit public exposure constraints from the parent tree and target moment.

Required public read checks:

```text
Tree-level comment public read:
- parent tree visibility is public
- comment is not deleted/moderated/hidden

Moment-level comment public read:
- parent tree visibility is public
- target moment is publicly readable under current policy
- comment is not deleted/moderated/hidden
```

Owner/private reads may follow owner access policy, but public endpoints must not expose private tree or private moment social data.

Reports and logs must use safe status labels. Do not print owner IDs, user IDs, tree IDs, memory IDs, raw payloads, tokens, sessions, cookies, private DB rows, or private response bodies.

---

## 8. Suggested implementation phases

### Phase 1 — Planning and contract docs

Document scope, permission model, moderation baseline, and API/data contract. This document is that first step.

### Phase 2 — Read-only viewer placeholders

Reserve tree-level and moment-level social surfaces in the future public viewer without enabling writes. This may be a UI/design task and should be tracked separately.

### Phase 3 — Read-only comments

Add read-only comment loading for public trees/moments if backend data exists. Verify public/private boundaries and empty states.

### Phase 4 — Authenticated comment writing

Allow authenticated write for one scope at a time. Start with either tree-level comments or moment-level comments, not both, unless separately approved.

### Phase 5 — Reactions and counts

Add scoped reaction counts after comment scope and moderation policies are stable.

### Phase 6 — Moderation/reporting

Add owner moderation, report flow, abuse handling, and administrative review if needed.

---

## 9. Follow-up issue split

Recommended follow-up issues/PR tracks:

1. Tree-level comments contract and read API.
2. Moment-level comments contract and read API.
3. Public viewer social placeholder design.
4. Authenticated tree-level comment write path.
5. Authenticated moment-level comment write path.
6. Reaction model and scoped count policy.
7. Moderation/reporting baseline.

Do not combine all social behavior into one PR.

---

## 10. Verification requirements for future implementation

Any future runtime PR must verify:

- tree-level and moment-level scopes are separate;
- logged-out reads respect parent public visibility;
- authenticated writes require auth when enabled;
- private trees do not expose public social data;
- moment-level comments respect parent tree and target moment boundaries;
- deleted/moderated comments are not publicly readable;
- owner and author permissions are enforced;
- no restricted identifiers or raw payloads are exposed;
- desktop/mobile behavior is verified only on valid deployed environments when UI is involved;
- Auth/API dependent behavior uses Cloudflare Preview or fixed test slot with SHA match.

---

## 11. Current disposition

This document satisfies the first planning layer for #622: social scope separation, permission direction, data model direction, moderation baseline, phased implementation, and follow-up split.

#622 should remain open until implementation follow-up issues/PRs are created or explicitly deferred.
