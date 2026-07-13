# Editor Detail UI Browser Smoke Checklist

Issue: #521
Related: #519, #520, #422, #223, #400

> **Disposition:** `NON_NORMATIVE_OUTSIDE_NAMED_CONTEXT` for agent-governance blocker/approval interpretations.
> Canonical agent-governance authority: `docs/ops/MVP_AGENT_GOVERNANCE.md` (owner-approved #3442 comment `4947327550`).
> This Issue #521 checklist's stricter fixed-slot / missing-slot (`BLOCKED_SLOT_DECISION_MISSING`) language is retained only within the editor-detail UI verification context named here and is **not** repo-wide automatic-blocker authority. Under canonical policy, fixed-slot absence is advisory, not an automatic blocker. Secret/private-payload protections remain in force.

This checklist defines the minimum browser smoke requirements for future editor detail UI implementation PRs. It is docs-only. It does not modify `pages/editor.html`, editor JavaScript, CSS, Auth, API, backend, workflow, package, deployment, prototype, reference, demo, or variant files.

## Purpose

Editor detail UI changes must not be treated as merge-ready from static review alone. Any change that affects current memory card rendering, action buttons, tree meta rendering, inline title edit, inline memo edit, save/cancel/error/hint states, or desktop/mobile editor interactions needs browser evidence.

This document provides the required PASS / NOT_VERIFIED / BLOCKED separation and the fixed-slot expectations for data-loaded or Auth/API-dependent editor behavior.

## Scope

Use this checklist for implementation PRs that touch editor detail UI responsibilities, including:

- current memory card rendering;
- current memory action buttons;
- tree meta render boundaries;
- inline title edit rendering and behavior;
- inline memo edit rendering and behavior;
- save, cancel, error, and hint states;
- selected-memory detail panel state;
- no-selection or empty detail panel state;
- desktop and mobile editor behavior.

## Non-goals

- No implementation in this checklist.
- No workflow automation from this checklist alone.
- No `js/editor.js` rewrite.
- No `pages/editor.html` rewrite.
- No Auth/API/backend/package/workflow changes.
- No PR #7/prototype/reference/demo/variant changes.
- No PR #450 changes.

## Verification target policy

Editor detail behavior is Auth/API/data dependent. Local static-server evidence alone is insufficient for final PASS when the scenario requires authenticated data, selected memory state, saved changes, or API-backed UI.

Use one of the following target classes:

| Target | Allowed use | Final PASS allowed? |
|---|---|---|
| Local static server | Syntax/load smoke only, no API/Auth/data claims | NO for data-loaded behavior |
| Cloudflare PR Preview | Static/render smoke and limited runtime smoke when connected to expected backend | YES only with URL provenance and deployed SHA |
| Fixed test slot | Auth/API/data-loaded editor verification | YES when slot assignment and deployed SHA are confirmed |
| Production | Post-merge smoke only when explicitly assigned | YES only for post-merge verification |

For fixed test slot verification, record:

- assigned slot name;
- deployed SHA;
- browser URL;
- account role category only;
- whether secret/private values were exposed: `NO`;
- PASS / NOT_VERIFIED / BLOCKED result per scenario.

Do not use unassigned fixed slots. Do not treat test slot evidence as valid without deployed SHA provenance.

## Minimum smoke matrix

| Scenario | Required result states | Notes |
|---|---|---|
| Editor desktop load | PASS / BLOCKED | Confirm no fatal console errors and editor shell renders |
| Empty or no-selection state | PASS / NOT_VERIFIED / BLOCKED | Verify where reachable without creating private data exposure |
| Populated tree with selected memory | PASS / NOT_VERIFIED / BLOCKED | Requires Auth/API/data-capable target |
| Current memory card visibility | PASS / NOT_VERIFIED / BLOCKED | Confirm content area remains stable; do not print private payloads |
| Current memory action buttons | PASS / NOT_VERIFIED / BLOCKED | Verify visibility and action binding where reachable |
| Tree meta rendering | PASS / NOT_VERIFIED / BLOCKED | Confirm title/visibility/count/share/open affordance preservation where applicable |
| Inline title edit active state | PASS / NOT_VERIFIED / BLOCKED | Verify start/edit UI state without exposing private title values |
| Inline title edit cancel flow | PASS / NOT_VERIFIED / BLOCKED | Confirm cancel restores previous UI state |
| Inline title edit save flow | PASS / NOT_VERIFIED / BLOCKED | Requires Auth/API/data-capable target; record only status |
| Inline memo edit active state | PASS / NOT_VERIFIED / BLOCKED | Verify editor UI state without exposing private memo values |
| Inline memo edit cancel flow | PASS / NOT_VERIFIED / BLOCKED | Confirm cancel restores previous UI state |
| Inline memo edit save flow | PASS / NOT_VERIFIED / BLOCKED | Requires Auth/API/data-capable target; record only status |
| Error/hint rendering | PASS / NOT_VERIFIED / BLOCKED | Use reachable safe state; do not force destructive data failures |
| Mobile 375px editor smoke | PASS / BLOCKED | Confirm no horizontal overflow and core controls remain reachable |
| Console errors | PASS / BLOCKED | Fatal errors block final merge readiness |

## Reporting rules

Every future editor detail implementation PR must report:

```text
Editor detail browser smoke
verification target: LOCAL_STATIC | PR_PREVIEW | FIXED_SLOT | PRODUCTION
URL provenance: PRESENT | MISSING
slot name: <slot-name> | NOT_APPLICABLE
verified deployed SHA: <sha> | NOT_VERIFIED
account role category: QA_USER | QA_ADMIN | NOT_APPLICABLE
private payload exposed: NO
secret/token/session/cookie exposed: NO

scenario results:
- desktop editor load: PASS | NOT_VERIFIED | BLOCKED
- empty/no-selection state: PASS | NOT_VERIFIED | BLOCKED
- populated tree selected memory: PASS | NOT_VERIFIED | BLOCKED
- current memory card: PASS | NOT_VERIFIED | BLOCKED
- action buttons: PASS | NOT_VERIFIED | BLOCKED
- tree meta rendering: PASS | NOT_VERIFIED | BLOCKED
- inline title edit active/cancel/save: PASS | NOT_VERIFIED | BLOCKED
- inline memo edit active/cancel/save: PASS | NOT_VERIFIED | BLOCKED
- error/hint state: PASS | NOT_VERIFIED | BLOCKED
- mobile 375px: PASS | NOT_VERIFIED | BLOCKED
- fatal console errors: NO | YES
```

A PR may be considered static-review clean while still browser `NOT_VERIFIED`. Do not collapse those statuses.

## Evidence restrictions

Allowed evidence:

- URL provenance;
- deployed SHA;
- slot name;
- account role category;
- PASS / NOT_VERIFIED / BLOCKED status;
- console fatal error presence/absence;
- sanitized screenshots that do not expose private payloads, if separately approved.

Forbidden evidence:

- tree IDs;
- owner IDs;
- copied tree IDs;
- raw memory, memo, title, comment, source URL, thumbnail URL, or private payload values;
- credentials, tokens, cookies, sessions, API keys, private keys, database URLs;
- browser storage contents;
- request or response bodies containing private data;
- QA account passwords or local credential file contents.

## Merge-readiness interpretation

Use the following interpretation:

- `PASS`: Scenario was verified on an appropriate target and no blocker was found.
- `NOT_VERIFIED`: Scenario was not checked or requires a stronger target than the one used.
- `BLOCKED`: Scenario could not be verified because of a target, account, deployment, console, runtime, or data setup blocker.

For PRs that change editor detail behavior:

- Static checks alone are not enough for final merge readiness.
- Auth/API/data-loaded editor scenarios require PR Preview with valid runtime or fixed test slot verification.
- Mobile 375px and no fatal console errors are required before final PASS.
- A missing slot assignment must be reported as `BLOCKED_SLOT_DECISION_MISSING`, not as PASS.

## Relationship to active work

This checklist does not approve or merge any implementation PR. It provides the browser verification gate for current and future editor detail UI PRs, including tree meta boundary work, current memory action work, and inline title/memo edit work.

If another editor PR is active, this docs-only checklist can proceed in parallel only when it does not modify editor runtime, page, CSS, Auth, API, package, workflow, or deployment files.

## Closure criteria for #521

Issue #521 can be closed when:

- an editor detail browser smoke checklist exists;
- it documents current memory card, action button, tree meta, inline title, inline memo, error/hint, desktop, and mobile coverage;
- it requires PASS / NOT_VERIFIED / BLOCKED separation;
- it states local static evidence is insufficient for Auth/API/data-loaded final PASS;
- it includes fixed-slot / deployed-SHA provenance requirements;
- it prohibits secret/private payload exposure.

Refs #521
Refs #422
Refs #223
Refs #400
