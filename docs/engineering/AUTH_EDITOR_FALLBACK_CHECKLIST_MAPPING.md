# Auth / Editor Fallback Checklist Mapping

**Status:** CHECKLIST_MAPPING  
**Primary issue:** #224  
**Related issues:** #223, #225, #78, #220  
**Scope:** Docs-only mapping of existing Auth and Editor transitional fallback findings to owner trackers and audit plans.

---

## 1. Purpose

This document maps the `auth.js` / `editor.js` transitional fallback patterns and `window.currentTreeMemories` / `window.currentTreeData` findings referenced by Issue #224 to the existing LoveBud owner trackers and audit plans.

This PR does not remove fallbacks, introduce an EditorStore, change Auth handoff, change Editor runtime behavior, or modify any JavaScript. It only records the current checklist status and ownership boundaries so future work is split into the correct PRs.

---

## 2. Ownership Summary

| Finding area | Primary owner / tracker | #224 status | Notes |
|---|---|---|---|
| `auth.js` transitional fallback cleanup | #78 | Deferred to primary tracker | #224 should not own broad Auth fallback removal. |
| Auth runtime boundary / same-origin contract context | #223 | Related only | API/Cloudflare/Modal boundary work remains separate from Auth fallback cleanup. |
| `editor.js` fallback factory audit | #225 and #322 audit path | Already planned / mapped | Implementation remains blocked until audit gate is complete. |
| `window.currentTreeMemories` global state audit | #225 and #322 audit path | Already planned / mapped | Do not implement store migration from #224. |
| `window.currentTreeData` global state audit | #225 and #322 audit path | Already planned / mapped | Same ownership as `currentTreeMemories`. |
| EditorStore or equivalent migration | #225 follow-up after audit | Deferred | Requires compatibility and browser smoke plan first. |
| Legacy runtime/fallback discovery notes | #220 where applicable | Related only | Use #220 only for broader runtime cleanup context, not direct implementation here. |

---

## 3. #224 Checklist Classification

### 3.1 Completed in #224 Context

The following can be considered completed for #224 as mapping work, not implementation work:

- Auth fallback cleanup is identified as **not owned by #224** and remains under #78.
- Editor fallback/global state cleanup is identified as **not directly implemented from #224** and remains under #225 / #322 audit planning.
- `window.currentTreeMemories` and `window.currentTreeData` are mapped to the Editor fallback/global state audit path.
- Runtime/API boundary work remains separate under #223.

### 3.2 Deferred

The following are deferred to their primary owner trackers:

- Removal or rewrite of Auth transitional fallback logic.
- Removal or rewrite of Editor inline fallback factories.
- Migration of `window.currentTreeMemories` to EditorStore or equivalent.
- Migration of `window.currentTreeData` to EditorStore or equivalent.
- Any compatibility alias cleanup.
- Any runtime behavior change that requires fixed-slot or production-equivalent smoke.

### 3.3 Not Applicable to #224 Implementation

The following are not implementation work for #224:

- Editing `js/auth.js` or `js/auth/**`.
- Editing `js/editor.js` or `js/editor/**`.
- Changing `pages/editor.html` script order.
- Changing Auth redirect/session behavior.
- Changing Editor data load/save behavior.
- Changing Cloudflare Functions, Modal, or database behavior.

---

## 4. Auth Fallback Cleanup Boundary

Auth fallback cleanup remains under #78 as the primary tracker.

#224 may reference Auth fallback patterns as a strategy or audit dependency, but it should not drive direct Auth implementation. Auth changes are high-risk because they can affect:

- protected route access;
- confirmed auth cache reconciliation;
- logout behavior;
- login redirect behavior;
- shared header Auth handoff;
- Firebase/Auth provider initialization timing.

Any future Auth fallback cleanup PR must define its own browser smoke matrix and must not be mixed with Editor fallback cleanup, API route mapping, CSS changes, or docs-only closure work.

---

## 5. Editor Fallback and Global State Boundary

Editor fallback and global state cleanup remains under #225 and the #322 audit path.

The mapped surfaces include:

- `createInlineLoadInitialTreeFallback`;
- `createInlineNormalizeMemoryFallback`;
- `createInlineLoadEditorMemoriesFallback`;
- `createInlineRefreshMemoriesFallback`;
- `window.currentTreeMemories` read/write inventory;
- `window.currentTreeData` read/write inventory;
- future EditorStore or equivalent migration criteria;
- compatibility alias cleanup criteria.

#224 should not remove these fallbacks or introduce a store. The correct sequence is:

1. Complete the fallback/global state audit.
2. Identify exact read/write ownership.
3. Preserve compatibility aliases where runtime code still expects globals.
4. Add or confirm browser smoke for editor load, memory add/edit/delete, title rename, and save flows.
5. Only then propose implementation PRs.

---

## 6. Relationship to #223, #225, #78, and #220

### #223

#223 owns runtime boundary and contract work where applicable, including Cloudflare/API/Modal route mapping and related contract protection. It does not directly own Auth or Editor fallback implementation unless a specific runtime contract requires clarification.

### #225

#225 owns Editor fallback/global state cleanup planning and implementation staging. It is the correct owner for `window.currentTreeMemories`, `window.currentTreeData`, and EditorStore migration criteria.

### #78

#78 remains the primary Auth cleanup tracker. Auth transitional fallback cleanup and Auth smoke requirements should be kept there.

### #220

#220 may provide broader runtime cleanup context. It should not be used to bypass the narrower ownership boundaries above.

---

## 7. Implementation Guardrails

Future implementation PRs must follow these guardrails:

- Do not combine Auth fallback cleanup with Editor fallback cleanup.
- Do not combine docs-only mapping with JS implementation.
- Do not remove compatibility globals without a consumer inventory.
- Do not change `window.initAuth()` handoff or protected route semantics from an Editor cleanup PR.
- Do not change Editor load/save behavior from an Auth cleanup PR.
- Do not mix Cloudflare/API route mapping with Auth or Editor fallback removal.
- Do not use local-only browser smoke as final PASS for Auth or Editor runtime changes.
- Do not touch PR #7 or prototype/reference/demo/variant paths.

---

## 8. Smoke Requirements for Future Implementation

Any future implementation PR must include a scoped smoke plan.

### 8.1 Auth Cleanup Smoke

Required when Auth fallback behavior changes:

- logged-out protected page redirect;
- confirmed auth cache reconciliation;
- login redirect target preservation;
- logout clears protected access;
- shared header Auth container handoff;
- no fatal console errors;
- fixed test slot or production-equivalent URL when Auth/API/runtime behavior is involved.

### 8.2 Editor Cleanup Smoke

Required when Editor fallback/global state behavior changes:

- editor load with existing tree;
- editor load with missing/invalid tree id;
- memory list render;
- memory add/edit/delete where applicable;
- title rename where applicable;
- save/refresh behavior;
- compatibility global reads/writes if not yet removed;
- no fatal console errors;
- fixed test slot or production-equivalent URL when API/Auth/runtime behavior is involved.

---

## 9. Final Recommendation for #224

For #224, the Auth/Editor fallback checklist should be treated as **mapped and deferred**, not as direct implementation backlog.

Recommended classification:

| #224 item | Recommendation |
|---|---|
| Auth fallback cleanup | Keep open under #78; do not implement here. |
| Editor fallback factories | Track under #225 / #322 audit; do not implement here. |
| `window.currentTreeMemories` | Track under #225 / #322 audit; do not implement here. |
| `window.currentTreeData` | Track under #225 / #322 audit; do not implement here. |
| API/runtime contract concerns | Keep under #223 where route/runtime boundary related. |

This lets #224 record the strategy decision without increasing runtime risk or duplicating ownership across trackers.
