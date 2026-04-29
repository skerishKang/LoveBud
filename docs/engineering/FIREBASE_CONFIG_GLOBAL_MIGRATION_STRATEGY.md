# Firebase Config Global Migration Strategy

> **Status:** STRATEGY_PLANNING
> **Source:** Issue #299
> **Type:** Docs-only planning — no implementation in this document

---

## 1. Purpose

This document defines a staged strategy for migrating Firebase config and auth global symbols to more explicit contracts while preserving compatibility with the current runtime.

This is a **planning document only**. No code, config values, script order, or runtime behavior changes are made in this document.

---

## 2. Current Documented Global Contract Summary

The current global contract (documented in `FIREBASE_CONFIG_CONTRACT.md`) includes:

| Global Symbol | Purpose | Migration sensitivity |
|---|---|---|
| `window.FIREBASE_CONFIG` | Firebase Web SDK configuration object | High — config source consumed before auth modules settle |
| `window.__lovebudFirebaseInitialized` | Boolean flag set after `firebase.initializeApp()` | Medium — idempotency guard |
| `window.initFirebase()` | Idempotent Firebase initialization function | High — page bootstrap compatibility |
| `window.__lovebudAuthInitialized` | Boolean flag after Auth observer setup | Medium — auth observer guard |
| `window.__lovebudAuthReady` | Boolean flag indicating auth state confirmed | High — protected-page pending-vs-signed-out behavior |
| `window.registerOnAuthReady(callback)` | Callback registration function | High — async auth handoff contract |
| `window.__onAuthReadyCallbacks` | Array of callbacks to invoke when auth confirmed | Medium — internal callback queue compatibility |

---

## 3. Migration Options Comparison

### Option A: Keep Current Globals with Documented Contract

Keep existing globals (`FIREBASE_CONFIG`, `initFirebase`, etc.) with documented contract.

- Pros: no runtime changes, lowest risk, simplest rollback
- Cons: scattered global namespace remains
- Best use: short-term baseline while Auth/Login and protected-page behavior remain active cleanup areas
- Recommendation: current safe default

### Option B: Add Window Namespace While Preserving Legacy Globals

Candidate shape:

```javascript
window.LoveBudFirebase = {
  config: window.FIREBASE_CONFIG,
  init: window.initFirebase,
  isInitialized: function () {
    return Boolean(window.__lovebudFirebaseInitialized);
  }
};
```

Add namespace while keeping legacy globals for backward compatibility.

- Pros: new explicit contract, backward compatible, small migration surface
- Cons: additional namespace to maintain until old globals are retired
- Required verification: contract tests and protected-page smoke
- Recommendation: best candidate for first implementation after test coverage

### Option C: Add IIFE Explicit Exports While Preserving Compatibility

Candidate shape:

```javascript
window.LoveBudFirebase = (function () {
  return {
    init: window.initFirebase,
    getConfig: function () {
      return Object.assign({}, window.FIREBASE_CONFIG);
    },
    isReady: function () {
      return Boolean(window.__lovebudFirebaseInitialized);
    }
  };
})();
```

IIFE pattern with explicit exports while preserving current globals.

- Pros: clearer access surface and read-only config copy option
- Cons: requires more deliberate API design than Option B
- Required verification: contract tests plus Login/My Trees/Editor/Settings smoke
- Recommendation: later candidate only after Option B or tests clarify needs

### Option D: Defer ES Module Migration

ES module migration requires separate approval and coordinated rollout.

- Pros: future dependency clarity
- Cons: significant change to script loading, Firebase SDK order, and page bootstrap assumptions
- Required verification: full script-load-order audit and Cloudflare Pages deployment impact review
- Recommendation: defer

---

## 4. Recommended Staged Path

### Stage 1 — Docs Strategy

- Document current global contract.
- Define migration options.
- Set guardrails and verification matrix.
- Keep implementation out of scope.

### Stage 2 — Test-Only Contract Coverage

- Add minimal contract tests for current global symbols, if the test harness can load or simulate the browser globals safely.
- Verify the current symbols and idempotency assumptions.
- No runtime behavior changes.

### Stage 3 — Compatibility Namespace Only

- Add `window.LoveBudFirebase` namespace per Option B.
- Keep legacy globals for backward compatibility.
- Do not move Firebase SDK script tags.
- Do not remove `window.FIREBASE_CONFIG` or `window.initFirebase()`.

### Stage 4 — Direct Global Usage Reduction

- Only after Stage 3 verification passes.
- Only after all affected pages are audited for call sites.
- Requires separate CTO approval.

---

## 5. Guardrails

### Do Not

- Change Firebase config values.
- Change Firebase SDK script order.
- Remove `initFirebase()` without compatibility verified.
- Remove or rename existing global symbols.
- Treat pending auth state as confirmed signed-out.
- Change Login/Auth UI behavior.
- Change protected page gating behavior.
- Change Settings, Editor, My Trees, Search, or runtime routing behavior.
- Mix with ES module conversion.
- Touch PR #7/prototype/reference/demo/variant paths.

### Preserve

- `initFirebase()` idempotency.
- Global auth-ready callback behavior.
- `__lovebudAuthReady` pending-vs-ready semantics.
- `FIREBASE_CONFIG` as the current source of truth in `js/firebase-config.js`.
- Existing page script order until a separate script-load-order PR is approved.

---

## 6. Option Decision Matrix

| Option | Runtime risk | Review complexity | Backward compatibility | Recommended next step |
|---|---:|---:|---:|---|
| A — keep current globals | Low | Low | Full | Keep as baseline |
| B — add namespace alias | Low-medium | Medium | Full if aliases remain | Candidate after tests |
| C — IIFE explicit exports | Medium | Medium-high | Full if aliases remain | Defer until namespace needs are clearer |
| D — ES modules | High | High | Requires careful bridge | Defer |

Operational decision:

- Do not implement C or D before a test-only contract PR exists.
- Do not reduce direct global usage before a compatibility namespace has shipped and passed smoke.
- Do not close #299 from a docs-only strategy update.

---

## 7. Verification Matrix Before Implementation

Before any implementation PR (Stage 3 or later), verify:

| Test Case | Expected Behavior |
|---|---|
| Login page smoke | Google sign-in, email sign-in, signup flows work |
| My Trees auth-pending | Neutral skeleton shown during auth pending |
| Editor protected-page | Redirects appropriately when not authenticated |
| Settings auth/return navigation | Auth state available on return navigation |
| Public header auth UI | Header renders correctly on public pages |
| Contract tests | If namespace added, tests must cover old and new contract |

---

## 8. Follow-up PR Split Proposal

| PR | Scope | Prerequisite |
|---|---|---|
| **PR A** | Docs strategy update | None |
| **PR B** | Test-only current global symbol contract | PR A reviewed |
| **PR C** | Optional compatibility namespace | PR B verified |
| **PR D** | Direct global usage reduction | PR C verified + approved |

No PR C or PR D work may begin without separate CTO approval. Both require production-equivalent browser verification.

---

## 9. References

- Issue #299: Firebase config global contract migration tracking
- `FIREBASE_CONFIG_CONTRACT.md`: Current active runtime contract
- `js/firebase-config.js`: Single source of truth for Firebase config
- `js/auth.js`: Auth layer implementation
- `docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md`: Security policy
- `SCRIPT_LOAD_ORDER.md`: page script loading contract

---

## 10. Verification Checklist

- [ ] CTO review
- [ ] Docs-only scope confirmed
- [ ] No JS/CSS/page/runtime/config changes
- [ ] No Firebase config values changed
- [ ] No script order changes
- [ ] No close/fixes/resolves keywords for #299

---

Refs #299
