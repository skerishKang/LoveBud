# Member Journey QA Suite

Refs #838
Refs #839
Refs #840
Refs #841
Refs #842
Refs #843
Refs #844
Refs #846

## Purpose

This document defines the reusable end-to-end member journey QA suite for LoveBud.

The suite verifies the product as a real member would experience it: first visit, signup, login, first tree creation, My Trees revisit, Editor usage, public/read-only viewing, logout, re-login, screenshots, and mobile coverage.

This is not a replacement for narrow PR-level checks. It is a higher-level browser verification layer used when a change can affect whether the product works as a coherent user journey.

## Persona-first execution model

Before choosing journeys, select a persona from [MEMBER_JOURNEY_PERSONAS.md](MEMBER_JOURNEY_PERSONAS.md).

Use this order for runtime-sensitive QA:

```text
persona -> journey -> issue/PR verification -> report
```

The persona answers who is using LoveBud and why. The journey answers which route and behavior must be verified. The issue/PR defines the exact implementation risk.

Every runtime-sensitive browser verification report should include:

```text
Persona selected:
Journey selected:
Why this persona applies:
Target URL:
Expected head SHA:
Deployed SHA:
SHA match:
Final status:
```

## Verification target policy

### Fixed test slot

Use a fixed test slot for any journey that creates, edits, persists, deletes, or reads private/authenticated user data.

Required evidence:

```text
fixed test slot URL
expected PR head SHA
actual deployed SHA
SHA match: YES / NO
real browser used: YES / NO
login-capable test account available: YES / NO / NOT_REQUIRED
```

### Production

Production checks are limited to non-destructive smoke unless explicitly approved.

Allowed production smoke examples:

```text
landing page opens
login page opens
public/read-only route opens
basic navigation renders
no fatal console/page error on first load
```

Do not repeatedly create throwaway production accounts or persistent production test data unless separately approved.

## Global guardrails

- Do not push directly to `main`.
- Do not mark a runtime-sensitive journey as final PASS without deployed SHA confirmation.
- Do not use `localhost` or static inspection as final PASS for Auth, My Trees, Editor, Browse, Search, or public/private boundary checks.
- Do not touch PR #7.
- Do not modify prototype/reference/demo/variant paths.
- Do not expose secrets, tokens, sessions, cookies, headers, passwords, private keys, DB URLs, tree IDs, owner IDs, memory IDs, copied tree IDs, raw restricted payloads, or DB row values.
- Use safe status labels instead of raw private identifiers.

## Journey tracks

```text
1. AUTH_SIGNUP_LOGIN_JOURNEY
2. FIRST_TREE_CREATION_JOURNEY
3. MY_TREES_RETURNING_USER_JOURNEY
4. EDITOR_MOMENT_EDITING_JOURNEY
5. PUBLIC_VIEWER_READONLY_JOURNEY
6. MOBILE_375_FULL_JOURNEY
7. LOGOUT_AND_PROTECTED_ROUTE_JOURNEY
8. ERROR_RECOVERY_JOURNEY
```

## 1. AUTH_SIGNUP_LOGIN_JOURNEY

Use when a PR or issue can affect signup, login, logout, session persistence, protected routes, or shared header auth state.

Typical personas:

```text
PERSONA_A_FIRST_TIME_CREATOR
PERSONA_B_RETURNING_OWNER smoke
PERSONA_D_MOBILE_CASUAL smoke
PERSONA_E_INTERRUPTED_USER smoke
```

Required scenario:

1. Visit the target as a logged-out user.
2. Confirm landing/intro/login entry points are understandable.
3. Create a new test account on a fixed test slot when signup is in scope.
4. Confirm post-signup route and header/account state.
5. Log out.
6. Attempt protected routes while logged out.
7. Log in with the created or approved test account.
8. Refresh and confirm session persistence.
9. Log out again.
10. Hard reload and confirm protected access remains blocked.

Report template:

```text
AUTH_SIGNUP_LOGIN_JOURNEY
Target:
- Persona:
- URL:
- Expected head SHA:
- Deployed SHA:
- SHA match:

Results:
- Logged-out first visit:
- Signup:
- Post-signup route:
- Login:
- Session persistence:
- Logout:
- Protected route block:
- Header/page auth consistency:
- Screenshots:
- Fatal console errors:
- Fatal network blockers:
- Secret/private data exposure:
- Final status: PASS / FAIL / BLOCKED / NOT_VERIFIED
```

Safe labels:

```text
SIGNUP_FORM_PRESENT
SIGNUP_SUCCESS
LOGIN_SUCCESS
SESSION_PERSISTED
PROTECTED_ROUTE_BLOCKED
AUTH_STATE_CONSISTENT
```

## 2. FIRST_TREE_CREATION_JOURNEY

Use when a PR or issue can affect first-time creation, first moment entry, save behavior, My Trees reflection, or Editor/detail persistence.

Typical personas:

```text
PERSONA_A_FIRST_TIME_CREATOR
PERSONA_D_MOBILE_CASUAL smoke
```

Required scenario:

1. Start from a logged-in test account on a fixed test slot.
2. Confirm the first tree/moment entry point is visible and understandable.
3. Create safe dummy first-moment content.
4. Save.
5. Confirm success/transition state.
6. Navigate to My Trees.
7. Confirm the new tree appears as an owned tree card.
8. Open the tree.
9. Confirm saved content appears in Editor/detail context.
10. Refresh and confirm persistence.

Report template:

```text
FIRST_TREE_CREATION_JOURNEY
Target:
- Persona:
- URL:
- Expected head SHA:
- Deployed SHA:
- SHA match:

Results:
- First-create entry point:
- Form/input clarity:
- Save action:
- Post-save route/state:
- My Trees reflection:
- Editor/detail open:
- Persistence after refresh:
- Desktop screenshot:
- Mobile screenshot if in scope:
- Fatal console errors:
- Fatal network blockers:
- Secret/private data exposure:
- Final status: PASS / FAIL / BLOCKED / NOT_VERIFIED
```

Safe labels:

```text
FIRST_CREATE_ENTRY_PRESENT
FIRST_MOMENT_SAVE_SUCCESS
OWNED_TREE_CARD_PRESENT
SAVED_CONTENT_PRESENT
PERSISTENCE_CONFIRMED
```

## 3. MY_TREES_RETURNING_USER_JOURNEY

Use when a PR or issue can affect My Trees, owned tree cards, card opening, loading/empty/error states, or account-gated rendering.

Typical personas:

```text
PERSONA_B_RETURNING_OWNER
PERSONA_D_MOBILE_CASUAL smoke
```

Required scenario:

1. Log in with an approved test account that has at least one saved tree.
2. Open My Trees.
3. Confirm owned tree cards load after Auth is confirmed.
4. Confirm empty/loading/error states are truthful where applicable.
5. Open an existing tree using the intended primary action.
6. Confirm the target opens in the expected Editor/detail route.
7. Return to My Trees.
8. Refresh and confirm cards remain stable.
9. Check desktop and mobile card layout if in scope.

Report template:

```text
MY_TREES_RETURNING_USER_JOURNEY
Target:
- Persona:
- URL:
- Expected head SHA:
- Deployed SHA:
- SHA match:

Results:
- Login/account menu:
- My Trees auth gating:
- Owned card load:
- Empty/loading/error state:
- Primary open action:
- Opened route:
- Return navigation:
- Refresh stability:
- Desktop screenshot:
- Mobile screenshot if in scope:
- Fatal console errors:
- Fatal network blockers:
- Secret/private data exposure:
- Final status: PASS / FAIL / BLOCKED / NOT_VERIFIED
```

Safe labels:

```text
OWNED_TREE_CARD_PRESENT
PRIMARY_OPEN_ACTION_WORKS
AUTH_CONFIRMED_BEFORE_RENDER
RETURN_TO_MY_TREES_WORKS
REFRESH_STABLE
```

## 4. EDITOR_MOMENT_EDITING_JOURNEY

Use when a PR or issue can affect Editor canvas load, node selection, detail panel updates, add/edit/cancel/save behavior, or persistence.

Typical personas:

```text
PERSONA_B_RETURNING_OWNER
PERSONA_D_MOBILE_CASUAL smoke
PERSONA_E_INTERRUPTED_USER smoke
```

Required scenario:

1. Log in with an approved test account.
2. Open My Trees.
3. Open an existing tree in Editor.
4. Confirm canvas and detail/editor panels load after Auth is confirmed.
5. Select an existing moment node.
6. Confirm selected state and detail panel update.
7. Open add-next or edit flow where applicable.
8. Enter safe dummy content.
9. Save and confirm persistence.
10. Reopen or refresh Editor and confirm the updated content remains present.
11. Test cancel behavior without unwanted mutation.
12. Confirm desktop and mobile usability when in scope.

Report template:

```text
EDITOR_MOMENT_EDITING_JOURNEY
Target:
- Persona:
- URL:
- Expected head SHA:
- Deployed SHA:
- SHA match:

Results:
- Login/account menu:
- Editor auth gating:
- Canvas load:
- Node selection:
- Detail panel update:
- Add/edit form open:
- Cancel behavior:
- Save behavior:
- Persistence after refresh:
- Desktop screenshot:
- Mobile screenshot if in scope:
- Fatal console errors:
- Fatal network blockers:
- Secret/private data exposure:
- Final status: PASS / FAIL / BLOCKED / NOT_VERIFIED
```

Safe labels:

```text
EDITOR_LOADED
NODE_SELECTION_WORKS
DETAIL_PANEL_UPDATED
ADD_FORM_OPENED
EDIT_SAVE_SUCCESS
CANCEL_NO_MUTATION
PERSISTENCE_CONFIRMED
```

## 5. PUBLIC_VIEWER_READONLY_JOURNEY

Use when a PR or issue can affect public/read-only LoveTree viewing, public/private boundaries, public viewer node selection, or read-only moment details.

Typical personas:

```text
PERSONA_C_PUBLIC_VIEWER
PERSONA_D_MOBILE_CASUAL smoke
```

Required scenario:

1. Prepare or identify a public/read-only test tree through an approved fixed-slot path.
2. Open the public viewer route as logged-out or clean-session visitor where applicable.
3. Confirm public viewer shell loads.
4. Confirm tree/moment content renders or fails gracefully.
5. Select a visible node/moment if available.
6. Confirm read-only detail panel or viewer state opens if implemented.
7. Confirm no edit/delete/owner-only controls are visible.
8. Confirm private-only data is not exposed.
9. Confirm back/close navigation returns to the tree/viewer context.
10. Capture desktop and mobile screenshots when in scope.

Report template:

```text
PUBLIC_VIEWER_READONLY_JOURNEY
Target:
- Persona:
- URL:
- Expected head SHA:
- Deployed SHA:
- SHA match:

Results:
- Public viewer route:
- Logged-out/visitor access:
- Public content render:
- Node/moment selection:
- Detail/read-only panel:
- Owner controls hidden:
- Private data boundary:
- Back/close navigation:
- Desktop screenshot:
- Mobile screenshot if in scope:
- Fatal console errors:
- Fatal network blockers:
- Secret/private data exposure:
- Final status: PASS / FAIL / BLOCKED / NOT_VERIFIED
```

Safe labels:

```text
PUBLIC_VIEWER_OPENED
PUBLIC_CONTENT_PRESENT
READONLY_PANEL_PRESENT
OWNER_CONTROLS_HIDDEN
PRIVATE_BOUNDARY_PRESERVED
COMMENT_LAYER_NOT_IMPLEMENTED
```

## 6. MOBILE_375_FULL_JOURNEY

Use when a PR or issue can affect mobile layouts, header/menu behavior, forms, cards, Editor panels, public viewer, or fixed-position UI.

Typical personas:

```text
PERSONA_D_MOBILE_CASUAL
PERSONA_A_FIRST_TIME_CREATOR when onboarding is in scope
PERSONA_C_PUBLIC_VIEWER when public viewer mobile is in scope
```

Minimum baseline:

```text
375px mobile baseline
```

Wider mobile smoke when UI-sensitive or layout-risky:

```text
390px / 393px modern phone baseline
430px large phone baseline
480px large Android fallback where applicable
```

Required scenario:

1. Visit the target at 375px viewport.
2. Confirm no horizontal overflow.
3. Confirm header/account/menu behavior.
4. Signup/login where the target journey requires it.
5. Open My Trees.
6. Create or open a tree where applicable.
7. Open Editor/detail/public viewer where applicable.
8. Confirm forms, panels, cards, and fixed elements remain usable.
9. Capture screenshots.

Report fields may be combined with the relevant journey report. Always include viewport width and overflow result.

Safe labels:

```text
NO_HORIZONTAL_OVERFLOW
MOBILE_HEADER_USABLE
FORM_USABLE
MOBILE_CARD_LAYOUT_USABLE
MOBILE_EDITOR_USABLE
```

## 7. LOGOUT_AND_PROTECTED_ROUTE_JOURNEY

Use with Auth and protected-page PRs.

Typical personas:

```text
PERSONA_B_RETURNING_OWNER
PERSONA_E_INTERRUPTED_USER
```

Required scenario:

1. Log in.
2. Open a protected page.
3. Confirm private content is visible only after Auth is confirmed.
4. Log out.
5. Hard reload.
6. Attempt protected pages.
7. Confirm block or redirect is consistent.
8. Confirm header/page auth state is not contradictory.

Safe labels:

```text
AUTH_CONFIRMED_BEFORE_RENDER
LOGOUT_SUCCESS
PROTECTED_ROUTE_BLOCKED
HEADER_PAGE_AUTH_MATCH
```

## 8. ERROR_RECOVERY_JOURNEY

Use when a PR or issue can affect loading, empty, degraded, failed, or back/close states.

Typical personas:

```text
PERSONA_E_INTERRUPTED_USER
PERSONA_A_FIRST_TIME_CREATOR smoke
PERSONA_C_PUBLIC_VIEWER smoke
```

Required checks:

1. Loading state is visible and truthful.
2. Empty state is understandable.
3. Degraded state does not look stuck.
4. Failed network/API state has recovery or clear messaging where applicable.
5. Auth-pending does not show private content.
6. Hard reload does not create contradictory UI.
7. Back/close navigation recovers cleanly.

Safe labels:

```text
LOADING_STATE_CLEAR
EMPTY_STATE_CLEAR
DEGRADED_STATE_CLEAR
BACK_NAVIGATION_RECOVERS
AUTH_PENDING_PRIVATE_CONTENT_HIDDEN
```

## PR-to-journey mapping

Use this mapping when deciding which journeys a future PR needs.

```text
Auth PR:
- Persona A or B depending on signup vs returning-user scope
- AUTH_SIGNUP_LOGIN_JOURNEY required
- LOGOUT_AND_PROTECTED_ROUTE_JOURNEY required
- MOBILE_375_FULL_JOURNEY smoke when UI-visible

My Trees PR:
- Persona B required
- MY_TREES_RETURNING_USER_JOURNEY required
- AUTH_SIGNUP_LOGIN_JOURNEY smoke when auth-gated rendering is touched
- MOBILE_375_FULL_JOURNEY required when card/layout changes

Editor PR:
- Persona B required
- EDITOR_MOMENT_EDITING_JOURNEY required
- FIRST_TREE_CREATION_JOURNEY smoke when first-create or persistence is touched
- MOBILE_375_FULL_JOURNEY required for canvas/panel/form changes

Public viewer PR:
- Persona C required
- PUBLIC_VIEWER_READONLY_JOURNEY required
- MOBILE_375_FULL_JOURNEY required for viewer/panel changes
- ERROR_RECOVERY_JOURNEY when loading/degraded states are touched

Browse/Search PR:
- Persona C when routes into public viewing are touched
- Relevant Browse/Search-specific checklist plus PUBLIC_VIEWER_READONLY_JOURNEY smoke when routes into public viewing are touched
- MOBILE_375_FULL_JOURNEY required when cards/hub/layout changes

Docs-only PR:
- Persona N/A unless the document claims runtime verification results
- Browser journey not required unless the document claims runtime verification results
```

## Final report status values

Use one final status:

```text
PASS
FAIL
BLOCKED
NOT_VERIFIED
```

Do not mark a runtime-sensitive journey as `PASS` if:

- fixed slot was required but not used;
- deployed SHA was not confirmed;
- browser was not used;
- login was required but unavailable;
- private data or secrets were exposed in the report.
