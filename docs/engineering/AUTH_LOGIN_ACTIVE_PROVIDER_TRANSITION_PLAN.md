# Auth/Login Active Provider Transition Plan

## Status

Planning document only. No runtime code is changed by this document.

Current baseline:

```text
main SHA: 1cf85be5ecef6273ae85863e22c12f2d44505363
runtime: Cloudflare Pages + Modal
API path: browser -> same-origin /api/* -> Cloudflare Pages Functions -> Modal -> Neon
```

Related PR context:

```text
PR #201: Auth/Login inactive controller parity merged
PR #202: active login/provider transition closed as out-of-scope
PR #203: inactive login controller binding hardening, merged
PR #203 merge commit: 31cfccdd07f459e939109c4686fb07407b46fe2e
```

This plan treats PR #203 as a completed preparatory hardening prerequisite only. It is not an active provider transition.

---

## Goal

Move Login page ownership from the legacy active provider path toward the dedicated `js/login/` controller boundary without changing user-visible Auth policy by accident.

The target outcome is:

```text
- login page controller owns login page DOM binding and page-specific UI state
- active email login execution is intentionally transitioned only after contract coverage exists
- auth.js no longer carries login page-specific UI responsibilities once fallback removal is safe
- Firebase/session/cache/redirect behavior remains unchanged unless a later explicit policy PR changes it
```

---

## Current provider boundary

### Active provider

```text
window.LoveBudAuthLoginPage
```

Current role:

```text
- remains the active login provider
- owns active email login execution path
- is treated as runtime source of truth before Phase 3 implementation
```

### Inactive/preparatory controller

```text
window.LoveBudLoginPageController
```

Current role:

```text
- preparatory login page controller boundary
- can own UI-only/idempotent binding behavior
- must not become active provider implicitly
- must not silently move Firebase email auth execution before the transition PR
```

### Legacy/global auth entry

```text
js/auth.js
```

Current role:

```text
- still participates in login/auth bootstrap responsibilities
- should not be aggressively reduced until active transition and fallback removal are proven safe
```

---

## Non-goals

This plan does not authorize:

```text
- changing Firebase sign-in semantics
- changing session/cache storage policy
- changing protected-route redirect policy
- changing logout policy
- changing test account data
- changing backend/API behavior
- moving Login UI copy/layout polish into the transition PR
- combining active transition with shared-header/profile dropdown work
```

---

## Phase split

## Phase 0: Freeze current assumptions

Purpose:

```text
Record exact current ownership before implementation.
```

Required checks:

```text
- confirm pages/login.html script order
- confirm which globals are created by js/auth.js, js/auth/auth-login-page.js, and js/login/login-page.js
- confirm submit handler ownership
- confirm redirect query handling
- confirm invalid credential/error display path
- confirm signup form behavior remains intentionally inactive/noop if applicable
```

Output:

```text
No code changes, or a docs-only audit update.
```

---

## Phase 1: Contract coverage before active switch

Purpose:

```text
Make the active transition mechanically reviewable before runtime wiring changes.
```

Required tests/contracts:

```text
- login controller exposes stable browser global
- controller init is idempotent
- submit binding does not double-bind
- redirect notice uses explicit redirect query only
- signup form behavior remains documented and guarded
- active provider remains unchanged before transition
```

Recommended files:

```text
tests/contracts/login-controller-skeleton-contract.test.js
tests/contracts/auth-bootstrap-contract.test.js
```

Forbidden in this phase:

```text
- changing pages/login.html script order
- moving email auth execution
- editing protected-route policy
```

---

## Phase 2: Active provider transition implementation

Purpose:

```text
Make the login page controller the intentional active boundary for login page behavior.
```

Allowed scope, to be narrowed by implementation audit:

```text
pages/login.html
js/login/login-page.js
js/auth/auth-login-page.js
js/auth.js
tests/contracts/login-controller-skeleton-contract.test.js
tests/contracts/auth-bootstrap-contract.test.js
```

Implementation constraints:

```text
- one branch, one PR
- no Search/Editor/Header/Modal changes
- no UI polish
- no copy change unless required by existing contract
- no backend/API changes
- no ES module import conversion
- preserve browser-global script model
```

Expected implementation shape:

```text
1. Keep old provider available as fallback during the first active switch if needed.
2. Route active Login page DOM binding through the dedicated login controller boundary.
3. Preserve existing Firebase sign-in call semantics.
4. Preserve redirect query behavior.
5. Preserve error rendering semantics.
6. Add tests proving old and new ownership do not double-bind submit handlers.
```

Transition PR title candidate:

```text
refactor(login): transition active provider to login controller
```

---

## Phase 3: Fixed test slot verification

Purpose:

```text
Verify Auth/Login runtime behavior on a deployment path that supports login/Auth runtime.
```

PR Preview is not sufficient for final PASS if Firebase/Auth/runtime behavior is involved.

Use one fixed slot only:

```text
test1.lovebud.pages.dev
test2.lovebud.pages.dev
test3.lovebud.pages.dev
test4.lovebud.pages.dev
test5.lovebud.pages.dev
```

Slot rules:

```text
- one fixed test slot = one PR until verification completes
- do not mix active transition PR with header/editor/search PRs on the same slot
- restore or release the slot after verification if required by ops policy
```

Required smoke:

```text
Desktop 1920x1080
- login page loads without fatal console error
- redirect notice appears only when redirect query is explicit
- invalid credential path displays expected error state
- valid test account logs in
- post-login redirect works
- protected page can be reached after login
- logout returns user to non-auth state
- returning to login page does not double-bind submit handler

Mobile 390x844
- login page layout has no horizontal overflow
- submit flow works with test account
- error state is readable
- redirect behavior remains stable
- fatal console error absent
```

Do not use production personal accounts for transition verification.

---

## Phase 4: Legacy fallback removal decision

Purpose:

```text
Reduce auth.js only after active transition is proven stable.
```

Required before removal:

```text
- active provider transition PR merged
- fixed slot smoke passed
- CI passed
- no duplicate submit binding reports
- no protected-route redirect regression
- no login/logout regression
```

Possible later PR title:

```text
refactor(auth): remove legacy login page fallback
```

Allowed scope should be narrower than Phase 2 and should not include new behavior.

---

## File ownership matrix

| File | Current role | Phase 2 risk | Notes |
| --- | --- | --- | --- |
| `pages/login.html` | script order and page markup | high | Change only if active provider handoff requires it. |
| `js/auth.js` | broad auth/bootstrap legacy responsibility | high | Do not shrink until transition is verified. |
| `js/auth/auth-login-page.js` | current active login provider area | high | Must preserve current runtime behavior. |
| `js/login/login-page.js` | preparatory login controller | medium-high | Intended active boundary candidate. |
| `tests/contracts/login-controller-skeleton-contract.test.js` | login controller contract | medium | Expand before/with transition. |
| `tests/contracts/auth-bootstrap-contract.test.js` | bootstrap/global contract | medium | Must prove global ownership remains stable. |

---

## PR sequencing

Recommended sequence:

```text
1. Confirm PR #203 merge commit is present in current main.
2. Create a docs/design PR for this Phase 3 plan.
3. Create a separate implementation PR for active provider transition.
4. Verify implementation on a fixed test slot.
5. Create a later fallback removal PR only after transition is stable.
```

Do not append active transition commits to PR #203.

---

## Implementation PR checklist

Before coding:

```text
- fetch latest origin/main
- confirm PR #203 merge commit is present in current main
- branch from current main only
- confirm no other Auth/Login active transition PR is open
- confirm test slot availability
```

During coding:

```text
- keep changed files limited to Auth/Login transition files
- preserve existing browser-global script model
- add/adjust contract tests first or with the transition
- avoid copy/layout polish
- avoid shared-header/profile dropdown changes
```

Before Ready for Review:

```text
- node --check changed JS files
- node --test relevant contract tests
- npm test
- fixed test slot browser smoke
- report changed files and exact head SHA
```

---

## Explicit forbidden combinations

Do not combine this transition with:

```text
- profile dropdown/header CSS polish
- editor current memory/card polish
- search heading copy or event delegation cleanup
- Modal route extraction
- Cloudflare Pages Functions changes
- DB schema changes
- visibility/private-storage policy behavior changes
- production data mutation tests
```

---

## CTO decision gates

Gate A: Plan accepted

```text
This document is accepted as the transition boundary.
```

Gate B: Implementation authorized

```text
A separate active provider transition implementation PR may be started.
```

Gate C: Runtime verified

```text
Fixed test slot Auth/Login smoke passes.
```

Gate D: Fallback removal authorized

```text
A later auth.js fallback removal PR may be started.
```
