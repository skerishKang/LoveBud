# Member Journey Personas

Refs #846
Refs #838
Refs #839
Refs #840
Refs #841
Refs #842
Refs #843
Refs #844

## Purpose

This document defines reusable personas for LoveBud member journey verification.

The journey suite defines what paths must be checked. Personas define who is performing those paths and why.

Use this order for runtime-sensitive QA:

```text
persona -> journey -> issue/PR verification -> report
```

A browser verification run should not only ask whether a button works. It should also ask whether the product makes sense for the user represented by the selected persona.

## Persona selection rule

Every runtime-sensitive PR should name at least one persona when requesting browser verification.

Runtime-sensitive areas include:

```text
Auth
My Trees
Editor
Browse/Search runtime
Public Viewer
public/private boundary
member data creation/edit/persistence
mobile-visible UI
loading/empty/error/degraded states
```

Docs-only PRs with no runtime claim may use:

```text
Persona: N/A
```

## Persona A — First-time fan memory creator

```text
Persona ID: PERSONA_A_FIRST_TIME_CREATOR
Display name: First-time fan memory creator
Starting state: New visitor
Device/viewport: Desktop first, mobile 375px when onboarding or layout is in scope
Auth state: Logged out
Data state: No existing LoveTree required
Primary goal: Understand LoveBud and create the first fan-memory LoveTree
Secondary goal: Confirm the saved tree appears in My Trees and can be reopened
Likely confusion: What is a LoveTree? Where do I start? Did my first moment save?
```

Required journeys:

```text
AUTH_SIGNUP_LOGIN_JOURNEY
FIRST_TREE_CREATION_JOURNEY
MOBILE_375_FULL_JOURNEY when UI-visible or mobile-sensitive
ERROR_RECOVERY_JOURNEY when loading/empty/degraded states are touched
```

Related issue families:

```text
first impression
intro/login clarity
signup/auth state
first moment affordance
first tree creation
save and persistence
mobile onboarding
```

Safe test data rule:

```text
Use fixed test slot for signup and first tree creation.
Do not create production test accounts or production test LoveTrees unless separately approved.
Use safe dummy content only.
```

Expected report labels:

```text
PERSONA_A_SELECTED
SIGNUP_SUCCESS
FIRST_CREATE_ENTRY_PRESENT
FIRST_MOMENT_SAVE_SUCCESS
OWNED_TREE_CARD_PRESENT
PERSISTENCE_CONFIRMED
NO_HORIZONTAL_OVERFLOW
```

## Persona B — Returning private scrapbook owner

```text
Persona ID: PERSONA_B_RETURNING_OWNER
Display name: Returning private scrapbook owner
Starting state: Returning member
Device/viewport: Desktop first; mobile 375px if My Trees or Editor layout is in scope
Auth state: Logged in or able to log in
Data state: Has at least one existing private or owned LoveTree
Primary goal: Reopen an existing tree and continue editing
Secondary goal: Confirm edits persist after refresh or revisit
Likely confusion: Which card opens my tree? Did editing save? Why did a protected page render before auth?
```

Required journeys:

```text
AUTH_SIGNUP_LOGIN_JOURNEY smoke
MY_TREES_RETURNING_USER_JOURNEY
EDITOR_MOMENT_EDITING_JOURNEY
LOGOUT_AND_PROTECTED_ROUTE_JOURNEY when Auth/protection is in scope
```

Related issue families:

```text
My Trees card clarity
protected-route gating
Editor node selection
moment editing
save/cancel behavior
session persistence
```

Safe test data rule:

```text
Use fixed test slot and approved test account.
Do not print tree IDs, owner IDs, memory IDs, raw payloads, or DB row values.
Use safe labels for existing data presence.
```

Expected report labels:

```text
PERSONA_B_SELECTED
OWNED_TREE_CARD_PRESENT
PRIMARY_OPEN_ACTION_WORKS
EDITOR_LOADED
NODE_SELECTION_WORKS
DETAIL_PANEL_UPDATED
EDIT_SAVE_SUCCESS
PERSISTENCE_CONFIRMED
PROTECTED_ROUTE_BLOCKED
```

## Persona C — Public viewer / fan visitor

```text
Persona ID: PERSONA_C_PUBLIC_VIEWER
Display name: Public viewer / fan visitor
Starting state: Visitor opening a public tree or shared route
Device/viewport: Desktop and mobile 375px when viewer UI is in scope
Auth state: Logged out or clean visitor session
Data state: Public/read-only test tree available
Primary goal: Open and understand a public LoveTree without editing it
Secondary goal: Select a moment and view creator memo/media if available
Likely confusion: Is this editable? Why is the tree empty? Is this public content or private owner data?
```

Required journeys:

```text
PUBLIC_VIEWER_READONLY_JOURNEY
MOBILE_375_FULL_JOURNEY when viewer layout is in scope
ERROR_RECOVERY_JOURNEY when loading/degraded states are touched
```

Related issue families:

```text
public viewer shell
read-only boundary
creator memo/media visibility
owner controls hidden
public/private data separation
public loading/degraded states
```

Safe test data rule:

```text
Use public/read-only test data on fixed slot or approved deployed target.
Use clean session where applicable.
Do not expose private route parameters, private IDs, raw payloads, or owner-only data.
```

Expected report labels:

```text
PERSONA_C_SELECTED
PUBLIC_VIEWER_OPENED
PUBLIC_CONTENT_PRESENT
READONLY_PANEL_PRESENT
OWNER_CONTROLS_HIDDEN
PRIVATE_BOUNDARY_PRESERVED
```

## Persona D — Mobile-only casual user

```text
Persona ID: PERSONA_D_MOBILE_CASUAL
Display name: Mobile-only casual user
Starting state: Mobile user arriving from a phone-class viewport
Device/viewport: 375px baseline; 390/393/430/480px smoke when layout-risky
Auth state: Logged out or logged in depending on target journey
Data state: May be new or returning depending on target journey
Primary goal: Complete the same core flow without desktop assumptions
Secondary goal: Confirm menus, forms, cards, panels, and fixed elements remain usable
Likely confusion: Hidden menu, clipped form, horizontal overflow, unreachable save/cancel, cramped editor/viewer panel
```

Required journeys:

```text
MOBILE_375_FULL_JOURNEY
AUTH_SIGNUP_LOGIN_JOURNEY smoke when auth UI is in scope
FIRST_TREE_CREATION_JOURNEY smoke when creation UI is in scope
MY_TREES_RETURNING_USER_JOURNEY smoke when card UI is in scope
EDITOR_MOMENT_EDITING_JOURNEY smoke when editor panel/canvas UI is in scope
PUBLIC_VIEWER_READONLY_JOURNEY smoke when viewer UI is in scope
```

Related issue families:

```text
header/menu usability
forms at mobile width
card overflow
Editor panel usability
bottom sheet/detail panel usability
wider mobile smoke
```

Safe test data rule:

```text
Use fixed test slot for Auth/data flows.
Do not create production data by default.
Capture screenshots without exposing private IDs or credentials.
```

Expected report labels:

```text
PERSONA_D_SELECTED
NO_HORIZONTAL_OVERFLOW
MOBILE_HEADER_USABLE
FORM_USABLE
MOBILE_CARD_LAYOUT_USABLE
MOBILE_EDITOR_USABLE
MOBILE_VIEWER_USABLE
```

## Persona E — Confused or interrupted user

```text
Persona ID: PERSONA_E_INTERRUPTED_USER
Display name: Confused or interrupted user
Starting state: User who reloads, backs out, cancels, or sees loading/error states
Device/viewport: Desktop or mobile depending on target PR
Auth state: Mixed; logged-out, auth-pending, and logged-in states may all be relevant
Data state: Existing or newly created test data depending on target PR
Primary goal: Recover without losing trust or seeing contradictory UI
Secondary goal: Confirm cancel/back/reload/loading/error states are truthful
Likely confusion: Did the app freeze? Did save happen? Why am I logged in and logged out at the same time? Did cancel mutate data?
```

Required journeys:

```text
ERROR_RECOVERY_JOURNEY
LOGOUT_AND_PROTECTED_ROUTE_JOURNEY when Auth state is in scope
AUTH_SIGNUP_LOGIN_JOURNEY smoke when auth-pending behavior is in scope
EDITOR_MOMENT_EDITING_JOURNEY smoke when cancel/save/back behavior is in scope
```

Related issue families:

```text
loading state clarity
empty state clarity
cancel behavior
back/close recovery
auth-pending privacy
degraded network/API state
```

Safe test data rule:

```text
Use non-destructive checks where possible.
If data mutation is required, use fixed test slot only.
Do not simulate destructive failures against production.
```

Expected report labels:

```text
PERSONA_E_SELECTED
LOADING_STATE_CLEAR
EMPTY_STATE_CLEAR
DEGRADED_STATE_CLEAR
BACK_NAVIGATION_RECOVERS
AUTH_PENDING_PRIVATE_CONTENT_HIDDEN
CANCEL_NO_MUTATION
```

## Issue and PR usage examples

Use this format in executor prompts:

```text
Persona:
- PERSONA_A_FIRST_TIME_CREATOR

Journeys:
- AUTH_SIGNUP_LOGIN_JOURNEY
- FIRST_TREE_CREATION_JOURNEY
- MOBILE_375_FULL_JOURNEY

Target:
- PR:
- Fixed slot:
- Expected head SHA:
```

Examples:

```text
Run PERSONA_A_FIRST_TIME_CREATOR against the signup + first-create path on fixed slot test-__.
Run PERSONA_B_RETURNING_OWNER against My Trees + Editor after an Editor PR.
Run PERSONA_C_PUBLIC_VIEWER against a public viewer PR using a clean visitor session.
Run PERSONA_D_MOBILE_CASUAL at 375px for a mobile-visible UI PR.
Run PERSONA_E_INTERRUPTED_USER when loading, cancel, reload, or protected-route behavior is touched.
```

## Final reporting rule

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

Use final status values from `MEMBER_JOURNEY_QA_SUITE.md`:

```text
PASS
FAIL
BLOCKED
NOT_VERIFIED
```
