# Cache Utils Lifecycle Audit

**Status:** Draft audit  
**Owner:** CTO / Engineering  
**Related issue:** #118  
**Scope:** docs-only audit; no runtime behavior changes

---

## 1. Purpose

This document records the current audit boundary for `js/cache-utils.js` before any cache lifecycle or serialization behavior changes are implemented.

The goal is to avoid changing cache behavior based on assumptions. LoveBud currently uses lightweight browser caching for API-backed UI surfaces, and cache changes can affect Auth, My Trees, Editor, Browse/Search, and Detail flows.

This document is descriptive and planning-only. It does not approve code changes.

---

## 2. Current audit target

Primary target:

```text
js/cache-utils.js
```

Related consumers and adjacent areas to inspect before implementation:

```text
js/auth.js
js/auth/*
js/postgres-client.js
js/api/*
js/search/*
js/my-trees.js
js/my-trees/*
js/editor.js
js/editor/*
js/detail.js
pages/search.html
pages/my-trees.html
pages/editor.html
pages/detail.html
```

Audit focus:

- `window.loveBudCache` in-memory cache behavior
- `window.LoveBudCache` public API
- `sessionStorage` mirroring behavior
- TTL-on-read expiration cleanup
- `clearPattern` and `clearAll` usage
- JSON serialization behavior
- login/logout cache clearing boundary
- long-lived browser session behavior

---

## 3. Current known behavior

Issue #118 describes the current cache model as follows:

```text
js/cache-utils.js keeps an in-memory cache on window.loveBudCache and mirrors entries into sessionStorage.
The implementation supports TTL, clearPattern, and clearAll.
Expired entries are mainly removed when read through getCache().
There is no periodic cleanup interval.
Values are serialized through JSON.stringify() for sessionStorage.
```

This means the current lifecycle is primarily demand-driven:

1. A caller stores a cache entry.
2. The entry is kept in memory and mirrored to browser storage when serialization succeeds.
3. Expiration is checked when a caller reads the entry.
4. Expired entries are removed during read or explicit cleanup calls.
5. Global cleanup is caller-driven, not timer-driven.

---

## 4. Risks to verify

### 4.1 Cache growth during long sessions

Potential risk:

- If users browse many trees/memories in one session, in-memory and sessionStorage cache entries may grow until reload, logout, explicit clear, or browser eviction.

Audit questions:

- Which keys can accumulate unboundedly?
- Are tree detail and memory list keys scoped by ID?
- Does Search/Browse use bounded cache keys or query-specific keys?
- Is there any path that stores large response payloads repeatedly?

Do not add periodic cleanup until real key usage and growth risk are mapped.

### 4.2 TTL-on-read only cleanup

Potential risk:

- Expired entries that are never read again may remain in memory/sessionStorage.

Audit questions:

- Is this acceptable for current page-load patterns?
- Does logout or auth state transition clear sensitive cache entries?
- Does page reload naturally reset the in-memory layer enough for current MVP behavior?
- Would a periodic cleanup interval introduce unnecessary complexity or race risk?

Default recommendation:

```text
Keep TTL-on-read unless concrete cache growth or stale-private-data risk is observed.
```

### 4.3 Serialization behavior

Potential risk:

- `JSON.stringify()` fails for circular or unsupported values.
- Non-plain objects may serialize lossy data.
- Large objects may exceed browser storage limits.

Audit questions:

- Are callers passing only plain JSON-compatible API responses?
- Does `setCache()` handle serialization failure gracefully?
- Should failed sessionStorage mirroring still keep in-memory cache?
- Should non-serializable values be rejected, warned, or stored in memory only?

Recommended first-pass policy:

```text
Cache values should be JSON-compatible plain data unless explicitly documented otherwise.
```

### 4.4 Auth and private data boundaries

Potential risk:

- Private tree or memory data may persist across logout/login transitions if cache clearing is incomplete.

Audit questions:

- Which cache keys contain private owner data?
- Which keys contain public browse data only?
- Are private keys cleared on logout?
- Are private keys cleared when Firebase user changes?
- Are cached entries user-scoped where needed?

Minimum rule:

```text
Private owner data cache must not survive user switch in a way that can render another user's data.
```

### 4.5 Stale UI state

Potential risk:

- My Trees, Editor, or Detail may render stale cached trees/memories after create, edit, visibility change, delete, copy/fork, or logout.

Audit questions:

- Which mutations call cache invalidation?
- Which mutations should clear tree list cache?
- Which mutations should clear tree detail cache?
- Which mutations should clear memory list cache?
- Does public Browse/Search cache need separate invalidation from owner/private cache?

---

## 5. Cache key inventory to complete

The audit should produce a concrete list of current key families.

Candidate families to inspect:

```text
lovebud_trees_cache
tree_detail_<treeId>
tree_memories_<treeId>
lovebud_auth_cache
lovebud_auth_confirmed
lovebud_auth_token
search / browse result keys if any
public tree preview keys if any
```

For each key family, record:

| Field | Required value |
|---|---|
| key pattern | exact key or pattern |
| owner | module that writes it |
| readers | modules that read it |
| data class | public / private / auth metadata / UI-only |
| TTL | current TTL or none |
| invalidation | clear path after mutation/logout |
| storage | memory only / sessionStorage mirror / localStorage elsewhere |
| risk | low / medium / high |

---

## 6. Recommended classification

Use this classification before changing cache behavior.

| Class | Meaning | Handling |
|---|---|---|
| Public browse cache | Public tree/search data only | Can survive page navigation; must not include private payloads |
| Owner-private cache | Authenticated user's trees/memories | Must clear on logout/user switch; should be scoped or invalidated after mutations |
| Auth metadata cache | Lightweight user/auth state | Must not be treated as authorization source |
| Token-like cache | Firebase ID token or token metadata | High risk; should be minimized and reviewed with Auth audit |
| UI-only cache | Non-sensitive transient view state | Low risk if bounded and serializable |

---

## 7. Implementation candidates after audit

Do not implement these until the key inventory is complete.

### Candidate A — documentation-only inventory

- Add current key map and ownership table.
- No runtime behavior change.

### Candidate B — serialization guard

Possible behavior:

- Wrap sessionStorage serialization in safe try/catch.
- Warn only in development/debug mode if serialization fails.
- Keep current behavior stable for JSON-compatible data.

Guardrail:

- Do not expose private payloads in logs.

### Candidate C — user-switch private cache clear

Possible behavior:

- Clear owner-private cache key families on logout and confirmed user switch.
- Keep public browse cache separate.

Guardrail:

- Verify Auth, My Trees, Editor, Search, and Detail on fixed slot when private cache behavior changes.

### Candidate D — mutation invalidation map

Possible behavior:

- Define which cache keys are invalidated after tree/memory create/update/delete/copy.
- Keep invalidation local and explicit.

Guardrail:

- Do not add broad `clearAll()` after every mutation unless necessary.

### Candidate E — periodic cleanup, only if justified

Possible behavior:

- Add conservative cleanup on page visibility change or startup, not a frequent interval.

Guardrail:

- Do not add timers without evidence of actual cache growth or stale entry risk.

---

## 8. Verification requirements for future code changes

Any PR that changes cache behavior should verify:

```text
Auth login/logout: PASS
User switch stale private data: NOT_REPRODUCED / PASS
My Trees list after create/delete: PASS
Editor memory create/update/delete: PASS when touched
Search/Browse public data load: PASS when public cache touched
Detail/public viewer private data leak: NO
Console fatal errors: NONE
Network fatal blockers: NONE
Private data exposure in logs: NO
```

If Auth/My Trees/Editor/Browse/Search flows are involved, use a fixed test slot with SHA match before final PASS.

---

## 9. Non-goals

This audit does not authorize:

- adding a periodic cleanup interval;
- changing cache key names;
- changing TTL values;
- removing cache entries;
- changing Auth token storage;
- changing API response handling;
- changing Search/Browse/Editor/My Trees behavior;
- logging cached private payloads;
- modifying PR #7 or prototype/reference/demo/variant paths.

---

## 10. Current disposition

This document satisfies the docs-only audit layer for #118.

Implementation remains separate. Any code PR should start from a concrete key inventory and must not mix cache lifecycle changes with unrelated Auth/API/Search/Editor refactors.
