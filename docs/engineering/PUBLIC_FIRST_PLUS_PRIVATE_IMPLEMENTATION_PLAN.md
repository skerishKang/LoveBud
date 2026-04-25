# Public-first + Plus private implementation plan

Status: planning only
Owner: Feature Lead
Scope: implementation branch split for Backend/API, Modal, Frontend, and QA
Base assumption: PR #32 and PR #33 are merged; current production behavior is private-first; CTO has approved public-first + Plus private policy.

## 1. CTO-confirmed policy baseline

1. New trees become public by default.
2. Existing private trees are not auto-published; they remain grandfathered private.
3. New memory visibility inherits the parent tree visibility by default.
4. Private trees and private memories are Plus private storage.
5. The 3-public-memory condition is a browse listing condition, not a public visibility toggle condition.
6. Private to public is allowed for the owner and must not use a 3-memory guard.
7. Public to private requires Plus entitlement.
8. The first entitlement source is the Firestore `users/{uid}` profile.
9. Plus-required API failures return `403` with `PLUS_REQUIRED_PRIVATE_STORAGE`.
10. Delete behavior remains the current hard-delete behavior in the first implementation pass.
11. Modal write paths must perform final entitlement verification, not only frontend or Netlify API verification.

Non-goals for this implementation wave:

- No automatic migration of existing private trees to public.
- No soft delete or archive policy change.
- No billing provider integration beyond reading the existing Firestore user profile.
- No browse ranking redesign beyond preserving browse visibility/listing eligibility.

## 2. Branch split

### 2.1 Backend/API branch

Proposed branch:

```text
backend/public-first-plus-private-api
```

Purpose:

- Change create-tree defaults to public.
- Enforce Plus entitlement for any private tree creation or public to private transition.
- Remove the 3-memory guard from private to public transitions.
- Keep browse listing eligibility separate from visibility mutation.
- Add API error contract for Plus-required failures.

### 2.2 Modal branch

Proposed branch:

```text
modal/public-first-plus-private-entitlement
```

Purpose:

- Mirror final entitlement enforcement in Modal write/runtime paths.
- Prevent private write paths from relying only on frontend or Netlify checks.
- Keep read-only/public browse runtime unaffected except where visibility filtering is already part of the contract.

### 2.3 Frontend branch

Proposed branch:

```text
frontend/public-first-plus-private-ui
```

Purpose:

- Align creation UI copy and payload behavior with public-first.
- Surface Plus-required messaging when public to private fails with `PLUS_REQUIRED_PRIVATE_STORAGE`.
- Keep existing grandfathered private trees visible/editable to owners.
- Remove any UI implication that 3 public memories are required for making a tree public.

### 2.4 QA branch / test plan branch

Proposed branch:

```text
qa/public-first-plus-private-smoke-plan
```

Purpose:

- Add or update QA checklist documents only.
- Define fixed test slot coverage for editor/my-trees/settings/auth/API flows.
- Record production smoke expectations after merge.

## 3. Candidate file map

This section is a planning candidate list. Each implementation lead must confirm actual current `main` paths before editing.

### 3.1 Backend/API candidates

Likely candidates:

- `netlify/functions/*tree*.js`
- `netlify/functions/*memory*.js`
- `netlify/functions/community-trees.js`
- `netlify/functions/*visibility*.js`
- `netlify/functions/*user*.js`
- `js/api/base-api-fetch.js` only if API error normalization is currently frontend-owned and not purely backend-owned
- `docs/engineering/API_CONTRACT.md` if the API contract document is updated in the backend PR

Areas to inspect first:

- Tree creation endpoint and request normalization.
- Tree visibility update endpoint.
- Memory creation/update endpoint.
- Public browse listing endpoint.
- Any auth/owner guard helper used by Netlify Functions.
- Any shared API response/error helper.

### 3.2 Modal candidates

Likely candidates:

- `modal_compute/app.py`
- `modal_compute/**`
- `modal_service/app.py`
- `modal_service/services/**`
- `modal_service/requirements.txt` if Firestore/Admin dependencies are needed and not already available
- `docs/ops/MODAL_BROWSE_RUNTIME.md` if runtime contract documentation needs a small update

Areas to inspect first:

- Modal write endpoints.
- Any Modal endpoint that can create/update trees or memories.
- Any Modal batch/runtime path that writes visibility-sensitive records.
- Secret/env loading for Firebase Admin or equivalent entitlement lookup.

### 3.3 Frontend candidates

Likely candidates:

- `pages/editor.html`
- `pages/my-trees.html`
- `pages/settings.html`
- `js/editor.js`
- `js/editor/*`
- `js/my-trees.js`
- `js/my-trees/*`
- `js/settings.js`
- `js/api/auth-policy.js`
- `js/api/base-api-fetch.js`
- `js/postgres-client.js`
- `js/i18n/i18n-editor.js`
- `js/i18n/i18n-my-trees.js`
- `js/i18n/i18n-settings.js`

Areas to inspect first:

- New tree creation payload.
- Visibility toggle UI and error handling.
- Editor private/public chip copy.
- My Trees private/public display and action availability.
- Settings/account area where Plus status may already be shown or can be read.

### 3.4 QA/documentation candidates

Likely candidates:

- `docs/engineering/PUBLIC_FIRST_PLUS_PRIVATE_IMPLEMENTATION_PLAN.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/product/VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md`
- `docs/ops/OPERATIONS.md`
- `docs/ops/DEPLOYED_ENTRY_MAP.md`

## 4. Firestore entitlement schema

First-pass entitlement source:

```text
users/{uid}
```

First-pass tolerant accepted fields:

```json
{
  "plan": "free | plus | admin",
  "plus": true,
  "privateStorageEnabled": true,
  "entitlements": {
    "privateStorage": true
  },
  "updatedAt": "server timestamp or ISO string"
}
```

First-pass normalization rule:

A user is private-storage entitled if any of the following is true:

```text
users/{uid}.privateStorageEnabled === true
OR users/{uid}.plan in ["plus", "admin"]
OR users/{uid}.plus === true
OR users/{uid}.entitlements.privateStorage === true
```

Canonical field decision:

```text
users/{uid}.privateStorageEnabled === true
```

Notes:

- `privateStorageEnabled` is the final authority for permission checks.
- `plan` is product/display metadata and may be used in the tolerant first pass, but it must not become the long-term authority for private storage permission.
- Backend and Modal must use the same normalization logic or a shared duplicated spec.
- Frontend may read Plus state for messaging, but frontend state is not authoritative.

Missing profile behavior:

```text
No users/{uid} profile => not entitled
Unreadable profile => not entitled, unless explicitly handled as transient server error by the API owner
```

Recommended helper contract:

```text
resolvePrivateStorageEntitlement(uid) -> {
  entitled: boolean,
  source: "firestore.users_profile",
  canonicalField: "privateStorageEnabled",
  reason?: string
}
```

## 5. API error contract

Plus-required private storage failure:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
```

```json
{
  "error": "PLUS_REQUIRED_PRIVATE_STORAGE",
  "code": "PLUS_REQUIRED_PRIVATE_STORAGE",
  "message": "Plus is required to create or keep a private LoveTree.",
  "details": {
    "requiredEntitlement": "privateStorage",
    "canonicalField": "users/{uid}.privateStorageEnabled",
    "source": "firestore.users_profile"
  }
}
```

Requirements:

- Status must be `403`.
- `code` must be stable: `PLUS_REQUIRED_PRIVATE_STORAGE`.
- Frontend must not branch on free-form message text.
- Backend and Modal must return the same code for the same entitlement failure.
- Auth failures remain separate from entitlement failures:
  - unauthenticated: `401`
  - owner mismatch: `403` with owner/permission code
  - Plus private storage missing: `403 PLUS_REQUIRED_PRIVATE_STORAGE`

## 6. Create tree transition order

### 6.1 Backend/API

1. Fetch and verify authenticated user.
2. Normalize create-tree input.
3. If client omits visibility, set `visibility = "public"`.
4. If client explicitly requests `visibility = "private"`, check Plus private storage entitlement.
5. If no entitlement, return `403 PLUS_REQUIRED_PRIVATE_STORAGE`.
6. Insert tree.
7. If root/default memory is created in the same flow, memory visibility inherits tree visibility.
8. Return created tree including effective visibility.

### 6.2 Frontend

1. Stop sending forced `visibility: "private"` for normal new-tree creation.
2. Prefer omitting visibility or explicitly sending `visibility: "public"`.
3. If private creation is exposed in UI, gate the action with Plus copy but still treat backend as authoritative.
4. On `PLUS_REQUIRED_PRIVATE_STORAGE`, show Plus-required private storage messaging.

### 6.3 Modal

1. Any Modal create-tree or create-memory write path must receive or resolve uid.
2. Apply the same public default when visibility is absent.
3. Enforce entitlement before private writes.
4. Return the same error code on entitlement failure.

## 7. Toggle visibility transition order

### 7.1 Private to public

1. Verify authenticated owner.
2. Do not apply 3-memory guard.
3. Update only `tree.visibility` to `public`.
4. Do not cascade existing memory visibility.
5. Existing private memories remain private.
6. New memory writes after the tree becomes public inherit public visibility by default.
7. Return updated tree visibility.
8. Browse listing may still exclude the tree until it satisfies browse listing rules, including 3 public memory eligibility if that rule remains active.

### 7.2 Public to private

1. Verify authenticated owner.
2. Resolve Plus private storage entitlement from Firestore `users/{uid}`.
3. If not entitled, return `403 PLUS_REQUIRED_PRIVATE_STORAGE`.
4. Update tree visibility to `private`.
5. New memory writes after this point inherit `private`.
6. Do not change delete behavior.

### 7.3 Browse listing separation

Visibility mutation and browse listing are separate decisions:

```text
Tree visibility = can the owner publish/unpublish the tree?
Browse listing eligibility = can this public tree appear in public browse/search surfaces?
```

Therefore:

- Private to public must not require 3 public memories.
- Browse listing may require public visibility and 3 public memories.
- Detail access rules must continue to protect private trees/memories.

## 8. Memory visibility inheritance rules

Default rule:

```text
On create memory:
  memory.visibility = request.visibility ?? parentTree.visibility ?? "public"
```

Constraints:

- Creating a private memory under any tree requires Plus private storage.
- Creating a memory under a private tree defaults to private and requires entitlement for new private storage.
- Creating a memory under a public tree defaults to public.
- Existing private memories are not auto-published.
- Existing private memories remain readable/editable by the owner under current owner access rules.

Grandfathered private non-Plus rule:

```text
Existing private content can be viewed and edited by the owner.
New private memory creation is not allowed unless the owner has Plus private storage entitlement.
If not entitled, API returns PLUS_REQUIRED_PRIVATE_STORAGE or the user must convert the tree to public before adding new public memories.
```

This preserves existing private content without granting indefinite new free private storage.

## 9. Grandfathered private handling

Definition:

```text
A grandfathered private tree is any tree where:
visibility === "private"
AND created_at < PUBLIC_FIRST_POLICY_CUTOVER_AT
```

Handling:

- Do not auto-publish.
- Do not mutate existing visibility in migration.
- Preserve owner read/edit access to existing tree and existing memories.
- Private to public is allowed for owner without 3-memory guard.
- Public to private after conversion requires Plus entitlement.
- New private storage under grandfathered private trees requires Plus entitlement.
- Do not add a `grandfathered_private` DB marker in the first implementation pass.
- Do not run schema migration in the first implementation pass.

Cutover constant:

```text
PUBLIC_FIRST_POLICY_CUTOVER_AT
```

Implementation note:

- The constant must be defined in backend/API and Modal policy code or a shared config equivalent.
- It must be set to the production deployment cutover timestamp approved for this policy rollout.

## 10. Test slot need

Fixed test slot is required.

Reason:

- Editor, My Trees, auth, API, DB, Firebase Auth, Firestore entitlement, and runtime write paths are involved.
- PR/branch preview domains may not be authorized for Firebase Auth/API key restrictions.

CTO-assigned slots:

```text
Backend/API PR -> test1
Modal PR -> test2
Frontend PR -> test3
Integration QA -> test4
Reserve / emergency regression / rollback check -> test5
```

Rules:

- One slot per PR during validation.
- Do not reuse the slot until the validation report is accepted.
- Production smoke happens only after merge/deploy approval.

## 11. Production smoke checklist

After approved merge and deploy:

### 11.1 Non-Plus user

- Create new tree.
- Confirm new tree is public by default.
- Confirm new memory defaults to public under public tree.
- Attempt public to private.
- Confirm API returns or UI reflects `PLUS_REQUIRED_PRIVATE_STORAGE`.
- Confirm no private tree is created through normal non-Plus flow.
- Confirm existing grandfathered private content remains readable/editable by the owner.
- Confirm new private memory creation in a grandfathered private tree is blocked for non-Plus.

### 11.2 Plus user

- Create public tree by default.
- Toggle public to private successfully.
- Create memory under private tree.
- Confirm new memory inherits private.
- Toggle private to public successfully without 3-memory guard.
- Confirm private to public changes only `tree.visibility` and does not cascade existing private memories.
- Confirm browse listing still follows listing eligibility separately.

### 11.3 Grandfathered private tree owner

- Existing private tree remains private.
- Owner can open the tree in editor/my-trees.
- Owner can view/edit existing private content.
- Owner can toggle private to public without 3-memory guard.
- Existing private memories remain private after tree is toggled public.
- New private memory creation is blocked for non-Plus.

### 11.4 Public browse/detail

- Public tree with insufficient listing eligibility does not appear in browse if 3-public-memory listing rule remains active.
- Public tree with sufficient listing eligibility appears in browse.
- Private tree does not appear in browse.
- Private memory does not leak in public surfaces.

### 11.5 Runtime/API

- Netlify API and Modal write path return consistent entitlement failures.
- No new console errors on editor/my-trees/settings.
- No unexpected network 500 on entitlement lookup failure.

## 12. PR separation order

Recommended order:

1. Documentation plan PR
   - Branch: `docs/public-first-plus-private-implementation-plan`
   - File: `docs/engineering/PUBLIC_FIRST_PLUS_PRIVATE_IMPLEMENTATION_PLAN.md`
   - No code changes.

2. Backend/API PR
   - Branch: `backend/public-first-plus-private-api`
   - Implements public-first defaults, entitlement guard, error contract, and browse listing separation.
   - Validated on fixed test slot `test1`.

3. Modal PR
   - Branch: `modal/public-first-plus-private-entitlement`
   - Mirrors entitlement enforcement for Modal write paths.
   - Validated on fixed test slot `test2` or Modal staging equivalent.
   - May proceed in parallel after API contract is stable, but should not merge before backend contract is accepted.

4. Frontend PR
   - Branch: `frontend/public-first-plus-private-ui`
   - Updates creation payload, toggle handling, and Plus-required messaging.
   - Should be based on accepted API contract.
   - Validated on fixed test slot `test3`.

5. QA/doc sync PR
   - Branch: `qa/public-first-plus-private-smoke-plan`
   - Updates checklists and records final production smoke steps.
   - Uses integration slot `test4`.

6. Integration validation
   - Fixed test slot with backend + frontend + Modal target configured.
   - CTO approval required before production merge/deploy.

## 13. Rollback strategy

### 13.1 Frontend rollback

- Revert frontend creation UI/payload changes.
- Keep backend public default if backend is already deployed only if CTO approves mixed mode.
- Otherwise revert frontend and backend together to avoid policy mismatch.

### 13.2 Backend/API rollback

- Revert create-tree default to previous behavior.
- Revert visibility toggle entitlement enforcement.
- Preserve database records already created under public-first; do not mutate user data during rollback unless CTO explicitly approves a data correction.

### 13.3 Modal rollback

- Revert Modal entitlement guard only if backend rollback also occurs or Modal write paths are temporarily disabled.
- Do not allow a state where Modal permits private writes while Netlify API blocks them.

### 13.4 Data rollback

- No automatic mass visibility mutation in rollback.
- Newly created public trees remain as created unless there is a separately approved data remediation plan.
- Grandfathered private trees remain private throughout.

### 13.5 Operational rollback trigger

Rollback should be considered if any of the following occurs:

- Non-Plus users can create private trees or private memories.
- Existing private trees become public automatically.
- Private memories leak into browse/detail public surfaces.
- Modal and Netlify return conflicting entitlement decisions.
- Authenticated editor/my-trees flows fail broadly on production.

## 14. Risk points

1. Existing client code may still send `visibility: private` during tree creation.
2. API and Modal may implement entitlement checks differently unless normalization is specified exactly.
3. Browse listing guard may be coupled to visibility toggle logic and must be separated carefully.
4. Grandfathered private behavior can be confused with free ongoing private storage.
5. Frontend preview domains may not validate auth/API/DB behavior; fixed test slots are required.
6. Firestore profile shape may be inconsistent across users; tolerant normalization is required.
7. Existing private memories under public trees may require a clear read/listing rule to prevent leaks.

## 15. CTO decisions recorded

The following decisions are confirmed for implementation:

1. Grandfathered private non-Plus users may view/edit existing private content, but may not add new private memories.
2. No `grandfathered_private` DB marker in the first pass.
3. Grandfathered private status is inferred by `visibility === "private" AND created_at < PUBLIC_FIRST_POLICY_CUTOVER_AT`.
4. Private to public changes only `tree.visibility`; it does not cascade existing memory visibility.
5. New memories inherit the parent tree visibility after the toggle.
6. First-pass entitlement normalization may be tolerant, but the final canonical entitlement field is `users/{uid}.privateStorageEnabled === true`.
7. Test slots are assigned as `test1` Backend/API, `test2` Modal, `test3` Frontend, `test4` Integration QA, `test5` reserve/rollback.

## 16. Code-start readiness

Code work is not started in this document PR.

Code status:

```text
Endpoint audit / API contract confirmation: allowed
Actual API behavior change: not started
UI implementation: not started
Modal implementation: not started
Firestore schema or data change: not started
Production data migration: not started
```

Recommended next step:

- Backend/API lead starts with endpoint audit and contract patch only.
- Modal lead starts only after the entitlement helper contract is fixed.
- Frontend lead starts after backend error code and create/toggle behavior are confirmed.
