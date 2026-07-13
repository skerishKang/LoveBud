# Work Risk Tier Policy

This document defines how LoveBud agents should choose the operating strictness for implementation, audit, and verification work.

The default operating model is no longer one-size-fits-all. Small, low-risk tasks should move quickly. High-risk tasks still require strict verification.

## Purpose

Use this policy to avoid over-processing simple changes while preserving safety for auth, backend, database, privacy, and destructive flows.

> **Canonical precedence:** `docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment `4947327550`). Risk tier is a verification-depth tool, not a permission system. Routine work is allowed by default; only the 6 hard rules are mandatory blockers. Conflicting sections are `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT`.

Agents should classify each task before execution as one of:

- Low risk: fast lane
- Medium risk: standard lane
- High risk: strict lane

Risk tier adjusts verification *depth*, not permission. Routine browser/code/test work needs no separate approval. Only actual destructive production mutation or secret/private-data risk is an approval target. When genuinely uncertain, pick the depth that matches real impact; do not default to the top tier as a blanket rule (canonical: `docs/ops/MVP_AGENT_GOVERNANCE.md`).

## Tier 1 — Low risk / fast lane

Use the fast lane for changes that are easy to inspect, easy to revert, and unlikely to affect runtime state or user data.

Examples:

- Copy text changes
- aria-label or title attribute polish
- Default value or fallback label additions
- Small CSS spacing/color/visibility adjustments
- Single helper extraction with unchanged behavior
- Contract test additions for an isolated helper
- Docs-only updates
- Clearly scoped dead-code or orphan-selector cleanup

Expected workflow:

1. Confirm the task scope and changed files.
2. Implement the smallest safe diff.
3. Run the most relevant local/static test only.
4. Create a PR.
5. If CI passes and the diff is within scope, merge/close without extra audit unless the owner requests one.

Fast lane does not require:

- Full fixed-slot deployment
- Full browser smoke
- Long audit report
- Repeated SHA/status narration
- Separate follow-up issue unless a real gap is discovered

Minimum report:

```text
Result: PASS
Changed files: ...
Verification: ...
PR: ...
```

## Tier 2 — Medium risk / standard lane

Use the standard lane for user-facing runtime behavior that can affect navigation, editor actions, mobile interactions, or visual state, but does not touch auth, backend writes, schema, or privacy boundaries.

Examples:

- Editor button behavior
- Mobile tap behavior
- Card click routing
- Public viewer UI display changes
- Floating toolbar action behavior
- Moment creation frontend flow
- Small frontend state changes
- CSS or JS changes that need browser confirmation

Expected workflow:

1. Confirm latest main and open PR count.
2. Keep the PR small and scoped.
3. Run relevant tests and `verify-static` when applicable.
4. Use a lightweight browser smoke only for the affected surface.
5. Report PASS / PARTIAL / FAIL.
6. Merge only after CI and the focused smoke are acceptable.

Standard lane report should be concise. Avoid broad audit tables unless the issue is explicitly an audit issue.

## Tier 3 — High risk / strict lane

Use the strict lane for changes that can break access control, stored data, production runtime, destructive actions, or cross-surface contracts.

Examples:

- Auth/session/login/logout changes
- Backend owner write routes
- Database schema or migration
- Firestore/storage/security rules
- Public/private visibility or entitlement policy
- Delete/destructive actions
- Reaction/comment backend or public exposure policy
- Large refactors of active runtime entrypoints
- API contract changes
- Deployment/runtime infrastructure changes

Expected workflow:

1. Confirm latest main SHA, open PR count, and changed-file boundary.
2. Inspect relevant source-of-truth docs.
3. Use a narrowly scoped branch and PR.
4. Run contract/static tests and affected integration tests.
5. Use fixed-slot or authenticated browser verification when required.
6. Record evidence without exposing raw tokens, UIDs, cookies, or private payloads.
7. Require explicit merge readiness review.

Strict lane may still use small slices, but each slice must preserve policy and runtime contracts.

## Always forbidden

Regardless of risk tier:

- Do not expose raw token, UID, cookie, private payload, or secret values.
- Do not modify PR #7, prototype, reference, demo, or variant paths unless explicitly requested by the task.
- Do not combine unrelated refactors with feature work.
- Do not use issue close keywords unless the issue is fully satisfied.
- Do not reopen or close issues automatically unless instructed or the audit result has been accepted.
- Do not invent a new route, schema, or backend path when an existing flow can be reused.

## CTO decision rule

Prefer speed for low-risk work and safety for high-risk work.

The default sequence is:

```text
Low risk  -> quick implementation + minimal verification
Medium    -> focused implementation + focused smoke
High risk -> strict verification + evidence
```

If a low-risk task unexpectedly reveals runtime ambiguity, upgrade it to medium risk.
If a medium-risk task touches auth, backend writes, schema, privacy, or destructive flows, upgrade it to high risk.

## Examples

| Task | Tier | Notes |
|---|---:|---|
| Add URL-only default title fallback | Low/Medium | Frontend payload helper + contract test. No backend/schema. |
| Add directional aria labels to branch ports | Low | a11y polish. Focused test or static inspection is enough. |
| Mobile bottom action bar first slice | Medium | User-facing mobile editor behavior; needs focused smoke. |
| My Trees mobile tap opens Editor | Medium | Navigation behavior; desktop must not regress. |
| Reaction/comment backend route | High | Auth, write policy, public exposure. Strict lane. |
| Owner write handler refactor | High | Backend write safety. Strict lane. |
| Docs-only operating policy update | Low | No runtime change. PR can be merged after review/CI. |

## Reporting templates

Fast lane:

```text
Result: PASS
Changed files:
- ...
Verification:
- ...
PR: #...
Next: ...
```

Standard lane:

```text
Result: PASS / PARTIAL / FAIL
Scope: ...
Changed files: ...
Verification: ...
Smoke: ...
Risk notes: ...
Next: ...
```

Strict lane:

```text
Result: PASS / PARTIAL / FAIL
Base SHA: ...
Head SHA: ...
Changed-file boundary: ...
Contract/security checks: ...
Runtime evidence: ...
Known limitations: ...
Merge recommendation: ...
```
