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

| Global Symbol | Purpose |
|---|---|
| `window.FIREBASE_CONFIG` | Firebase Web SDK configuration object |
| `window.__lovebudFirebaseInitialized` | Boolean flag set after `firebase.initializeApp()` |
| `window.initFirebase()` | Idempotent Firebase initialization function |
| `window.__lovebudAuthInitialized` | Boolean flag after Auth observer setup |
| `window.__lovebudAuthReady` | Boolean flag indicating auth state confirmed |
| `window.registerOnAuthReady(callback)` | Callback registration function |
| `window.__onAuthReadyCallbacks` | Array of callbacks to invoke when auth confirmed |

---

## 3. Migration Options Comparison

### Option A: Keep Current Globals with Documented Contract

**Keep existing globals (`FIREBASE_CONFIG`, `initFirebase`, etc.) with documented contract.**

- Pros: No runtime changes, lowest risk
- Cons: Scattered global namespace
- Recommendation: Short-term recommended path

### Option B: Add Window Namespace While Preserving Legacy Globals

```javascript
window.LoveBudFirebase = {
  config: FIREBASE_CONFIG,
  init: initFirebase,
  initialized: __lovebudFirebaseInitialized
};
```

Add namespace while keeping legacy globals for backward compatibility.

- Pros: New explicit contract, backward compatible
- Cons: Additional namespace to maintain
- Recommendation: Candidate for next staged PR

### Option C: Add IIFE Explicit Exports While Preserving Compatibility

```javascript
window.LoveBudFirebase = (function() {
  return {
    init: initFirebase,
    getConfig: () => ({...FIREBASE_CONFIG})
  };
})();
```

IIFE pattern with explicit exports while preserving current globals.

- Pros: Explicit encapsulation
- Cons: Requires test coverage
- Recommendation: Candidate for later staged PR

### Option D: Defer ES Module Migration

ES module migration requires separate approval and coordinated rollout.

- Pros: Future-proofing
- Cons: Significant change, requires careful rollout
- Recommendation: Defer until stable state achieved

---

## 4. Recommended Staged Path

### Stage 1 — Docs Strategy (This PR)

- Document current global contract
- Define migration options
- Set guardrails and verification matrix

### Stage 2 — Test-Only Contract Coverage

- Add minimal contract tests for current global symbols (if tests directory adds coverage)
- Verify global symbols accessible
- No runtime behavior changes

### Stage 3 — Compatibility Namespace Only (After Approval)

- Add `window.LoveBudFirebase` namespace per Option B
- Keep legacy globals for backward compatibility
- Verify all pages continue working

### Stage 4 — Direct Global Usage Reduction (After Verification)

- Only after Stage 3 verification passes
- Only after all affected pages verified against new namespace
- Requires separate CTO approval

---

## 5. Guardrails

### Do Not

- Change Firebase config values in this issue
- Change Firebase SDK script order
- Remove `initFirebase()` without compatibility verified
- Remove or rename existing global symbols
- Treat pending auth state as confirmed signed-out
- Change Login/Auth UI behavior
- Change protected page gating behavior
- Change settings/editor/runtime behavior
- Mix with ES module conversion

### Preserve

- `initFirebase()` idempotency
- Global auth-ready callback behavior
- `__lovebudAuthReady` flag semantics
- `FIREBASE_CONFIG` as single source of truth in `js/firebase-config.js`

---

## 6. Verification Matrix Before Implementation

Before any implementation PR (Stage 3 or later), verify:

| Test Case | Expected Behavior |
|---|---|
| Login page smoke | Google sign-in, email sign-in, signup flows work |
| My Trees auth-pending | Neutral skeleton shown during auth pending |
| Editor protected-page | Redirects appropriately when not authenticated |
| Settings auth/return navigation | Auth state available on return navigation |
| Public header auth UI | Header renders correctly on public pages |
| Contract tests | If namespace added, tests must cover new contract |

---

## 7. Follow-up PR Split Proposal

| PR | Scope | Prerequisite |
|---|---|---|
| **PR A** | Docs strategy (this PR) | None |
| **PR B** | Test-only current global symbol contract | PR A merged |
| **PR C** | Optional compatibility namespace | PR B verified |
| **PR D** | Direct global usage reduction | PR C verified + approved |

> **No PR C or PR D work may begin without separate CTO approval.**
> Both require production-equivalent browser verification.

---

## 8. References

- Issue #299: Firebase config global contract migration tracking
- `FIREBASE_CONFIG_CONTRACT.md`: Current active runtime contract
- `js/firebase-config.js`: Single source of truth for Firebase config
- `js/auth.js`: Auth layer implementation
- `docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md`: Security policy

---

## 9. Verification Checklist (This PR)

- [ ] `git diff --check` passes
- [ ] Changed files limited to strategy docs/index links
- [ ] No JS/CSS/page/runtime/config changes
- [ ] No Firebase config values changed
- [ ] No `close`/`fixes`/`resolves` keywords for #299 in this document