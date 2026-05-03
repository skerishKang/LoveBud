# Editor Entrypoint Orchestration Boundary

**Status:** Active staged-refactor boundary  
**Owner:** CTO / Engineering Lead  
**Related issue:** #659  
**Depends on:** #656 large-file audit, #657 detail UI boundary, #658 canvas boundary

This document defines the staged boundary plan for thinning `js/editor.js` without changing Editor runtime behavior.

The Editor entrypoint is a high-risk orchestration file. It ties together Auth-gated page bootstrap, selected tree state, memory loading, editor module initialization, canvas/detail coordination, action wiring, and legacy browser-global compatibility. A safe refactor must reduce entrypoint responsibility without changing user-visible behavior or script loading contracts.

---

## 1. Boundary principle

The first implementation PRs should not rewrite the Editor page. They should move one orchestration concern at a time into focused helpers while keeping `js/editor.js` as the page-level bootstrap entrypoint.

Safe direction:

```text
js/editor.js remains the top-level page orchestrator
helper modules own narrowly defined setup/wiring responsibilities
existing browser-global contracts remain stable
Auth/API behavior remains unchanged
Editor visual behavior remains unchanged
```

Do not combine entrypoint cleanup with canvas rendering changes, detail panel changes, save/persist behavior changes, Auth provider changes, or page markup restructuring.

---

## 2. Responsibility buckets

| Bucket | Examples | First safe action |
| --- | --- | --- |
| Page bootstrap | DOMContentLoaded/init sequence, guard clauses | Extract only pure sequencing helpers |
| Module initialization | canvas/detail/sidebar/helper factory setup | Preserve order and fallback behavior |
| State wiring | selected tree, current memory, global bridge state | Document before moving |
| Event orchestration | page-level listeners, cross-module callbacks | Extract one listener group at a time |
| Data load coordination | trees, memories, selected tree handoff | Avoid behavior changes in first PR |
| Render coordination | canvas/detail refresh triggers | Keep visual output equivalent |
| Legacy compatibility | `window.*` aliases and fallback state | Preserve until separate audit proves unused |
| Error/loading bridge | page-level degraded/error states | Extract after current behavior is mapped |

---

## 3. Preserved contracts

These contracts must remain stable unless a separate approved PR changes them:

```text
pages/editor.html script order
classic browser script loading model
Auth/protected-route behavior
selected tree handoff behavior
current memory selection behavior
canvas initialization order
detail panel initialization order
save/update action behavior
loading/error state behavior
window.currentTreeMemories compatibility
window.currentTreeData compatibility
existing editor helper global usage
console fatal error posture
network/API request contract
```

Reports must not expose credential values, tokens, sessions, cookies, DB URLs, owner IDs, tree IDs, memory IDs, copied tree IDs, raw API payloads, or DB row values.

Use safe status labels only:

```text
EDITOR_BOOTSTRAP: PASS/FAIL/NOT_VERIFIED
AUTH_GATE: PASS/FAIL/NOT_VERIFIED
SELECTED_TREE_HANDOFF: PASS/FAIL/NOT_VERIFIED
CANVAS_INIT: PASS/FAIL/NOT_VERIFIED
DETAIL_PANEL_INIT: PASS/FAIL/NOT_VERIFIED
SAVE_ACTIONS: PASS/FAIL/NOT_VERIFIED
PRIVATE_PAYLOAD_EXPOSURE: NO/YES
```

---

## 4. Recommended implementation sequence

### PR A — entrypoint runtime inventory or contract test

Goal:
- Record current Editor startup order, expected globals, selected tree handoff path, and module initialization dependencies.

Allowed:
- docs inventory or focused contract tests;
- no runtime behavior change.

### PR B — pure bootstrap helper extraction

Allowed:
- move small initialization sequence helpers into a focused module;
- preserve `js/editor.js` as the entrypoint;
- keep script order unchanged unless explicitly tested.

Forbidden:
- no Auth behavior changes;
- no canvas/detail rendering changes;
- no selected tree handoff changes.

### PR C — module factory wiring helper extraction

Allowed:
- extract argument construction and compatibility wiring for existing Editor helper factories;
- preserve callback references and fallback behavior.

Forbidden:
- no factory behavior changes;
- no page markup changes.

### PR D — page-level event wiring helper extraction

Allowed:
- move one page-level listener group at a time;
- preserve event targets and behavior.

Forbidden:
- no broad event delegation rewrite;
- no interaction behavior redesign.

### PR E — loading/error bridge helper extraction

Allowed:
- extract page-level loading/error helpers if behavior and copy remain equivalent.

Forbidden:
- no loading UX redesign;
- no new API retry policy.

---

## 5. Forbidden combinations

Do not combine Editor entrypoint orchestration cleanup with:

- canvas node/edge rendering refactors;
- detail panel render refactors;
- title/memo/moment edit UI changes;
- save/delete/persist behavior changes;
- selected tree handoff bug fixes unless this issue is explicitly rescoped;
- Auth provider/session changes;
- Modal/API/backend changes;
- CSS visual redesign;
- package/workflow changes;
- PR #7 or prototype/reference/demo/variant changes.

---

## 6. Editor entrypoint contract gate

Every implementation PR touching `js/editor.js` should include this matrix:

```text
[Editor Entrypoint Contract Gate]
Entrypoint remains classic browser script: YES/NO
pages/editor.html script order changed: YES/NO
Auth/protected-route behavior changed: YES/NO
Selected tree handoff behavior changed: YES/NO
Canvas init behavior changed: YES/NO
Detail panel init behavior changed: YES/NO
Save/update behavior changed: YES/NO
Legacy window globals removed: YES/NO
Runtime files changed:
Static checks: PASS/FAIL/NOT_RUN
Editor browser smoke: PASS/PARTIAL/BLOCKED/NOT_RUN
Private payload exposure: NO
Secret exposure: NO
Final judgment: PASS/PARTIAL/BLOCKED/FAIL
```

If any behavior changes intentionally, the PR is not a behavior-equivalent refactor and must be tied to the relevant bug/product issue.

---

## 7. Required verification for implementation PRs

Static checks:

```text
git diff --check
node --check changed JS files
npm test
npm run verify
```

Runtime checks:

```text
Login/auth gate works: PASS/FAIL
Editor route opens after login: PASS/FAIL
Selected tree state loads: PASS/FAIL
Current memory/detail panel initializes: PASS/FAIL
Canvas initializes or safe empty state appears: PASS/FAIL
Existing add/edit/save actions remain wired where applicable: PASS/FAIL/NOT_APPLICABLE
Console fatal errors: NONE/PRESENT
Network fatal errors: NONE/PRESENT
Desktop smoke: PASS/FAIL
Mobile 375px smoke: PASS/FAIL
Private payload exposure: NO
Secret exposure: NO
```

Because Editor is Auth/API-dependent, final runtime PASS requires Cloudflare Preview or fixed test slot with deployed SHA confirmation. Local-only PASS is not sufficient.

---

## 8. Batch verification handling

Docs-only boundary PRs may be accumulated in a batch. Runtime code PRs that touch `js/editor.js` may be drafted in a batch only when they are narrow, behavior-equivalent, and not blocking another Editor verification path.

Do not batch high-risk changes that alter:

```text
Auth gating
selected tree handoff
memory save/update/delete
canvas render scheduling
detail panel selection state
```

Use this status language for draft runtime PRs awaiting verification:

```text
Status: DRAFT_IMPLEMENTED / EDITOR_ENTRYPOINT_RUNTIME_VERIFICATION_NOT_STARTED
Static checks: PASS or NOT_RUN
Browser verification: NOT_STARTED
Merge candidate: NO
```

---

## 9. First implementation recommendation

The safest first code PR after this boundary note is one of:

1. Add an Editor startup inventory or contract test that records expected script dependencies and globals.
2. Extract a pure bootstrap sequencing helper without changing script order or behavior.
3. Extract a small factory argument construction helper while preserving all callback references.

Do not start with selected tree handoff fixes, save behavior, canvas rendering, or detail panel rendering. Those require separate issue ownership and immediate runtime verification.

---

## 10. Closure criteria for #659

Issue #659 should remain open until one or more narrow implementation PRs reduce `js/editor.js` responsibility while preserving behavior and recording required static plus runtime evidence.

A docs-only boundary PR can make implementation safer, but it does not complete the refactor by itself.
