# Member Journey QA Suite

Refs #838
Refs #839
Refs #840
Refs #681
Refs #823
Refs #825

## Purpose

LoveBud needs a reusable end-to-end member journey QA suite that verifies the product as a real member would experience it, not only as isolated PR slices.

This document defines the initial suite structure, required browser targets, safe reporting labels, screenshot requirements, and the first two concrete journey checklists:

- `AUTH_SIGNUP_LOGIN_JOURNEY`
- `FIRST_TREE_CREATION_JOURNEY`

It does not implement automation, create test accounts, mutate production data, or change runtime behavior.

## Operating model

Use separate verification levels.

### Fixed test slot

Required for runtime-sensitive or persistent user journeys:

- signup;
- login;
- protected route checks;
- first tree creation;
- first moment creation;
- Editor save/edit flows;
- My Trees persistence checks;
- public viewer checks tied to a PR;
- destructive, write, or account-state-changing QA paths.

Required proof:

```text
fixed test slot
expected PR head SHA
served/deployed SHA
SHA match: YES
real browser
login-capable test account
```

### Production

Production is limited to non-destructive smoke unless explicitly approved.

Allowed production checks:

- landing page loads;
- Intro/Home public copy smoke;
- Login page loads;
- public Browse/Detail/Viewer non-write smoke;
- no account creation by default;
- no repeated throwaway data creation by default.

Production must not be used as pre-merge proof for Auth/API/My Trees/Editor/Browse runtime changes when a fixed slot is required.

## Global journey tracks

The suite should cover these tracks over time:

```text
AUTH_SIGNUP_LOGIN_JOURNEY
FIRST_TREE_CREATION_JOURNEY
MY_TREES_RETURNING_USER_JOURNEY
EDITOR_MOMENT_EDITING_JOURNEY
PUBLIC_VIEWER_READONLY_JOURNEY
MOBILE_375_FULL_JOURNEY
LOGOUT_AND_PROTECTED_ROUTE_JOURNEY
ERROR_RECOVERY_JOURNEY
```

Each track should report:

- target URL;
- expected SHA;
- deployed SHA;
- SHA match;
- account state;
- steps performed;
- screenshots captured;
- fatal console/page/network status;
- safe final status;
- private data exposure status.

## Safe reporting rules

Reports must not include:

- credentials;
- tokens;
- sessions;
- cookies;
- headers;
- passwords;
- private keys;
- DB URLs;
- tree IDs;
- owner IDs;
- memory IDs;
- copied tree IDs;
- raw restricted payloads;
- DB row values;
- private URLs or console secret values.

Use status labels and count categories only.

Safe status examples:

```text
SHA_MATCH_CONFIRMED
LOGIN_SUCCESS
SIGNUP_SUCCESS
SESSION_PERSISTED
PROTECTED_ROUTE_BLOCKED
FIRST_CREATE_ENTRY_PRESENT
FIRST_MOMENT_SAVE_SUCCESS
OWNED_TREE_CARD_PRESENT
SAVED_CONTENT_PRESENT
PERSISTENCE_CONFIRMED
FATAL_CONSOLE_ERRORS_NONE
SECRET_EXPOSURE_NO
```

## Screenshot requirements

Runtime-sensitive journeys should capture enough visual proof for review without exposing private identifiers.

Minimum screenshot set when applicable:

- initial logged-out/entry state;
- post-login or post-signup state;
- primary action form/state;
- success/persistence state;
- mobile 375px state when the journey includes mobile;
- modern mobile smoke viewport when required by mobile viewport policy;
- error or blocked state if the journey fails.

Screenshots must be reviewed for accidental private ID, credential, token, or raw payload exposure before posting.

## Journey 1: AUTH_SIGNUP_LOGIN_JOURNEY

Related issue: #839

### Purpose

Verify the real member Auth path: first visit, signup when in scope, login, logout, re-login, session persistence, and protected-route behavior.

### Required browser target

Runtime-sensitive Auth verification requires:

```text
fixed test slot
confirmed deployed SHA match
real browser
login-capable test account
```

Production is non-destructive smoke only unless explicitly approved.

### Required scenario

1. Visit the target as a logged-out user.
2. Confirm landing, intro, or login entry points are understandable.
3. Create a new test account on a fixed test slot when signup is being verified.
4. Confirm post-signup route and header/account menu state.
5. Log out.
6. Attempt protected routes while logged out.
7. Log in with the created or approved test account.
8. Refresh and confirm session persistence.
9. Log out again.
10. Hard reload and confirm protected access remains blocked.

### Required protected routes

At minimum:

```text
/pages/my-trees.html
/pages/editor.html
/pages/settings.html
```

Add route variants only if relevant to the PR under verification.

### Required report template

```text
[AUTH_SIGNUP_LOGIN_JOURNEY]
Target URL:
Expected head SHA:
Deployed SHA:
SHA match: YES/NO
Browser target: fixed slot / production smoke
Test account source: APPROVED / CREATED_FOR_TEST / NOT_USED

Logged-out first visit: PASS/FAIL/BLOCKED
Signup: PASS/FAIL/BLOCKED/NOT_IN_SCOPE
Post-signup route: PASS/FAIL/BLOCKED/NOT_IN_SCOPE
Login: PASS/FAIL/BLOCKED
Session persistence after refresh: PASS/FAIL/BLOCKED
Logout: PASS/FAIL/BLOCKED
Protected route block: PASS/FAIL/BLOCKED
Header/page auth consistency: PASS/FAIL/BLOCKED
Screenshots captured: YES/NO
Fatal console errors: NONE/PRESENT
Fatal network blockers: NONE/PRESENT
Secret/private data exposure: NO/PRESENT
Final status: PASS/FAIL/BLOCKED/NOT_VERIFIED
```

### Acceptance criteria

- Auth entry and post-auth state are coherent.
- Header and page body do not show contradictory Auth states.
- Protected routes are blocked or redirected after logout.
- Session persistence is verified after refresh.
- No private data is exposed in the report.

## Journey 2: FIRST_TREE_CREATION_JOURNEY

Related issue: #840

### Purpose

Verify that a newly signed-in member can create a first LoveTree or first moment, then see the created content persist into My Trees and Editor.

### Required browser target

Because this journey creates persistent user data, final verification requires:

```text
fixed test slot
confirmed deployed SHA match
real browser
login-capable test account
```

Production is non-destructive smoke only unless explicitly approved.

### Required scenario

1. Start from a logged-in test account on a fixed test slot.
2. Confirm the entry point for creating the first tree or first moment is visible and understandable.
3. Create safe dummy first-moment content.
4. Save.
5. Confirm success or transition state.
6. Navigate to My Trees.
7. Confirm the new tree appears as an owned tree card.
8. Open the tree.
9. Confirm saved content appears in Editor or detail context.
10. Refresh and confirm persistence.

### Safe dummy content requirements

Use benign non-private placeholder content. Do not include secrets, private names, real credentials, private URLs, or personal data.

Safe examples:

```text
Title: QA first moment
Memo: Safe QA memory for member journey verification.
Tag/category: generic / test-safe
```

Do not print generated internal IDs after creation.

### Required report template

```text
[FIRST_TREE_CREATION_JOURNEY]
Target URL:
Expected head SHA:
Deployed SHA:
SHA match: YES/NO
Browser target: fixed slot / production smoke
Test account source: APPROVED / CREATED_FOR_TEST

First-create entry point: PASS/FAIL/BLOCKED
Form/input clarity: PASS/FAIL/BLOCKED
Save action: PASS/FAIL/BLOCKED
Post-save route/state: PASS/FAIL/BLOCKED
My Trees reflection: PASS/FAIL/BLOCKED
Editor/detail open: PASS/FAIL/BLOCKED
Persistence after refresh: PASS/FAIL/BLOCKED
Desktop screenshot: PASS/FAIL/NOT_IN_SCOPE
Mobile screenshot: PASS/FAIL/NOT_IN_SCOPE
Fatal console errors: NONE/PRESENT
Fatal network blockers: NONE/PRESENT
Secret/private data exposure: NO/PRESENT
Final status: PASS/FAIL/BLOCKED/NOT_VERIFIED
```

### Acceptance criteria

- First-create entry point is discoverable.
- First content can be saved.
- Created tree appears in My Trees.
- Saved content can be opened in Editor or detail context.
- Refresh confirms persistence.
- No restricted values are exposed.

## Mobile coverage

Default mobile journey coverage must include 375px baseline when mobile is in scope.

When UI risk is high, also include modern mobile smoke coverage as defined by the mobile viewport policy:

```text
390px or 393px modern baseline
430px large mobile smoke
480px only when large/Ultra-class behavior is relevant
```

Report baseline and modern mobile separately:

```text
MOBILE_BASELINE_375: PASS/FAIL/NOT_VERIFIED
MODERN_MOBILE_SMOKE: PASS/FAIL/NOT_VERIFIED/NOT_REQUIRED
```

## Error recovery journey placeholder

Future `ERROR_RECOVERY_JOURNEY` should cover:

- failed login;
- expired/stale session;
- failed first tree save;
- failed Browse copy/import;
- unavailable public viewer tree;
- network/API degraded states.

This document does not yet implement detailed error recovery steps. Add them in a separate follow-up when #838 is expanded.

## Follow-up split

Recommended follow-up issues or PRs:

1. Add detailed `MY_TREES_RETURNING_USER_JOURNEY` checklist.
2. Add detailed `EDITOR_MOMENT_EDITING_JOURNEY` checklist.
3. Add detailed `PUBLIC_VIEWER_READONLY_JOURNEY` checklist.
4. Add detailed `ERROR_RECOVERY_JOURNEY` checklist.
5. Convert this suite into browser executor prompts after the document is accepted.
6. Consider a non-secret local harness only after manual journey reports stabilize.

## Current disposition

This document satisfies the initial documentation layer for #838, #839, and #840. Those issues should remain open until the suite is used in actual fixed-slot browser verification or explicitly split into completed follow-up tracks.
