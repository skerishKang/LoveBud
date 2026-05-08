# Authorization Boundary

Refs #281
Refs #266

## Purpose

This document records the current LoveBud application-data authorization boundary after the Firestore usage audit and Modal/Neon authorization static audit.

It is a documentation-only boundary note. It does not change runtime code, database queries, Firebase Console settings, deployment configuration, workflows, package files, or Firestore Rules.

## Current architecture

LoveBud currently uses Firebase for authentication only.

Application data is not served from Firestore in the current repository paths audited for trees, comments, moments, or memories. Application data flows through the same-origin API layer and server-side runtime/database path:

```text
Browser
-> Firebase Auth ID token
-> same-origin /api/*
-> Cloudflare Functions API forwarding
-> Modal runtime/API authority
-> Neon/Postgres application database
```

## Current security interpretation

Because Firestore is not the active application-data store, Firestore Rules hardening is not the current primary control for LoveBud app-data privacy.

The active privacy and ownership control is expected to live in:

```text
- authenticated request handling at the /api/* and Modal boundary;
- Firebase token verification in the server/runtime layer;
- server-side owner/public/private authorization checks;
- Neon/Postgres query predicates for owner, visibility, and resource scope.
```

Client-side filtering must not be treated as the security boundary for private data.

## Firestore status

Static repository audit result:

```text
Firebase Auth usage: PRESENT
Firestore SDK app-data usage: NOT_FOUND
Direct Firestore app-data reads: NOT_FOUND
Direct Firestore app-data writes: NOT_FOUND
firestore.rules: NOT_PRESENT
firebase.json: NOT_PRESENT
```

Issue #281 should remain inactive-residual while Firestore remains unused for LoveBud app data. If Firestore is introduced later for trees, comments, moments, memories, or other app data, #281 should be reactivated before that path launches.

## Modal / Neon boundary status

Static repository audit classification:

```text
AUTH_BOUNDARY_APPEARS_SOUND_STATIC
```

The audit did not identify critical or high-severity gaps from static repository review. This does not replace runtime tests, but it means no immediate security fix PR is required based on the audited repository state.

## Required ownership rules for future changes

Future app-data routes should preserve these rules:

```text
- Private and owner-only data must be authorized server-side.
- Write, update, and delete paths must verify the authenticated user against the resource owner or approved policy.
- Public Browse/Search paths must not return private data.
- Detail/viewer/public routes must distinguish public resources from owner-only resources server-side.
- Client-provided ownerId, userId, treeId, memoryId, or visibility values must not be trusted without server-side validation.
- Neon queries should include owner/visibility/resource predicates where required.
```

## Test coverage targets

Future security tests should prioritize:

```text
- private route without auth returns unauthorized;
- owner-only read rejects a different authenticated user;
- update/delete rejects non-owner users;
- public Browse/Search excludes private records;
- client owner/user spoofing is rejected server-side;
- public/detail viewer cannot fetch a private resource by ID;
- write paths bind new records to the authenticated user or parent resource owner.
```

Tests that require actual login, API behavior, or deployed runtime should use the project fixed-slot/browser verification policy. Static or local unit tests are useful but must not overclaim browser/runtime PASS when the product path is auth/API-dependent.

## Non-goals

```text
- No Firestore Rules implementation.
- No Firebase Console mutation.
- No Modal runtime change.
- No Neon schema or query change.
- No Cloudflare Functions change.
- No package or workflow change.
- No production deployment.
- No PR #7 or prototype/reference/demo/variant change.
```

## Operational rule

When a future issue proposes Firestore Rules work, first determine whether Firestore is active for LoveBud app data. If Firestore remains inactive, rules hardening is residual tracking rather than the active app-data security boundary.

When a future issue changes Modal, Cloudflare Functions, API client behavior, or Neon query ownership checks, treat it as part of the active authorization boundary and require security-oriented review.
