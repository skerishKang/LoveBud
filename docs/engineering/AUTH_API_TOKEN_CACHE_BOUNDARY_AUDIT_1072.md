# Auth/API Token Cache Boundary Audit

Issue: #1072

This audit records the current Auth/API responsibility boundary around `js/api/base-api-fetch.js`. It is documentation-only and does not change token storage, auth behavior, API behavior, or login behavior.

## Current responsibility cluster

`js/api/base-api-fetch.js` currently combines several responsibilities:

| Responsibility | Current owner | Boundary concern |
| --- | --- | --- |
| API transport | `base-api-fetch.js` | should remain in API fetch layer |
| auth header construction | `base-api-fetch.js` | may remain as API/Auth bridge |
| token cache read/write | `base-api-fetch.js` | candidate for Auth-owned helper boundary |
| auth bootstrap waiting | `base-api-fetch.js` plus Auth globals | candidate for Auth-owned helper boundary |
| retry after auth-related failure | `base-api-fetch.js` | should stay close to API transport but depend on Auth helper contract |
| confirmed auth state clearing | `base-api-fetch.js` plus Auth globals | candidate for Auth-owned helper boundary |
| private cache clearing event | `base-api-fetch.js` | should remain explicit and documented |

## Desired boundary

Future implementation should avoid growing the API transport layer into a broad Auth/session/cache owner.

Recommended split:

```text
auth token/session helpers
→ provide safe token/header/cache helpers

base API fetch
→ calls helper boundary
→ performs same-origin fetch
→ handles retry and response shaping
```

The first implementation step should be a no-behavior-change helper extraction or facade. Do not change storage semantics and extraction in the same PR.

## Suggested helper contract

A future helper module may expose functions such as:

```text
readCachedAuthTokenRecord()
writeCachedAuthTokenRecord(user, tokenResult)
waitForAuthBootstrapReady(maxMs)
buildAuthHeaders(options)
clearConfirmedAuthState(reason)
```

Names are illustrative only. The implementation PR should preserve existing global compatibility and script order.

## Error contract watchpoints

A future implementation must preserve current behavior for:

- 401 handling when a confirmed session exists;
- 403 handling for permission or entitlement errors;
- API error object fields such as `status`, `statusCode`, `data`, and `code`;
- `PLUS_REQUIRED_PRIVATE_STORAGE` propagation;
- public reads that intentionally skip auth.

## Forbidden scope for first implementation

Do not combine helper extraction with:

- Firebase provider changes;
- login UI changes;
- token storage policy changes;
- backend auth changes;
- Cloudflare gateway changes;
- Modal route changes;
- broad `auth.js` rewrite;
- page script-order changes.

## Verification for future implementation

Implementation follow-up should verify:

- targeted JS/static tests;
- login page smoke;
- logout smoke;
- protected route smoke;
- private `/api/trees` and `/api/memories` smoke on an approved preview/fixed slot if runtime behavior changes;
- public Browse/Search still loads without requiring Firebase Auth readiness.

## Closure condition

This audit is complete when a future PR has a clear API/Auth helper boundary and does not need to infer token/cache ownership from `base-api-fetch.js` alone.
