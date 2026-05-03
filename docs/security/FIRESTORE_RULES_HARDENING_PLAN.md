# Firestore Rules Hardening Plan

**Status:** Active security plan  
**Owner:** CTO / Security-Ops  
**Related issue:** #281  
**Related posture issue:** #266

This document defines a staged plan for hardening Firebase Firestore Security Rules for LoveBud without exposing restricted values or weakening the current Cloudflare Pages plus Modal runtime model.

Issue #281 identified that Firestore Rules need explicit owner and visibility boundaries. This plan is a security planning document. It does not apply console rules, deploy rules, mutate data, or change client/backend runtime behavior.

---

## 1. Security boundary

Reports, PR bodies, issues, logs, and screenshots must never include:

```text
Firebase service account JSON
private key
API token
session token
cookie
authorization header
password
DB URL
owner id
tree id
memory id
comment id
copied tree id
raw Firestore document path containing private IDs
raw DB row value
```

Use safe aggregate labels only:

```text
RULES_REVIEWED: YES/NO
OWNER_BOUNDARY_PRESENT: YES/NO/UNKNOWN
VISIBILITY_BOUNDARY_PRESENT: YES/NO/UNKNOWN
ANONYMOUS_BROAD_READ: YES/NO/UNKNOWN
ANONYMOUS_BROAD_WRITE: YES/NO/UNKNOWN
CREATE_OWNER_VALIDATION: YES/NO/UNKNOWN
COMMENT_AUTHOR_VALIDATION: YES/NO/UNKNOWN
RESTRICTED_VALUES_EXPOSED: NO/YES
```

If a restricted value is exposed, stop and report `SECURITY_INCIDENT_SECRET_OR_PRIVATE_ID_EXPOSURE` without repeating the value.

---

## 2. Current known gaps

The original #281 finding identified these Firestore Rules risks:

| Gap | Current concern | Risk |
| --- | --- | --- |
| Tree read | Broad/unrestricted read may exist | Private trees may be exposed |
| Tree create | Missing owner validation may exist | Ownership spoofing or inconsistent data |
| Comment read | Broad/unrestricted read may exist | Comments may ignore parent tree visibility |
| Comment create | Missing author validation may exist | Authorship spoofing |
| Rules tracking | Rules may be console-only | No version control or rollback source |

These findings must be re-verified against the current Firebase Console/rules state before any production change. Do not assume stale rule content is still current.

---

## 3. Desired policy

The target Firestore policy should align with LoveBud's public/private model.

Expected tree access:

```text
public tree read: allowed for public tree data intended for anonymous read
private tree read: owner/admin only
create tree: authenticated user must be owner
update tree: owner/admin only, except narrowly constrained public counters if explicitly approved
delete tree: owner/admin only
```

Expected comment access, if comments are active:

```text
comment read: inherits parent tree visibility
create comment: authenticated user must be author
update/delete comment: author/admin or owner-moderation path, depending on final product policy
```

Current active runtime may proxy many operations through Cloudflare/Modal rather than direct browser Firestore reads. That does not remove the need for Firestore Rules. Rules remain a defense-in-depth boundary and must not allow unrestricted private data access.

---

## 4. Phase 0 — source and console inventory

Before writing or deploying rules, record source-of-truth status:

```text
[Firestore Rules Inventory]
Rules tracked in repository: YES/NO
Console rules reviewed: YES/NO
Active client direct Firestore reads: YES/NO/UNKNOWN
Active client direct Firestore writes: YES/NO/UNKNOWN
Active Cloudflare/Modal proxy path: YES/NO/UNKNOWN
Restricted values exposed: NO
```

If rules are console-only, the first implementation should add a tracked source file or explicit export process before broad policy changes.

---

## 5. Phase 1 — repository rules snapshot and tests

First implementation should create a durable source-of-truth workflow before changing production rules.

Expected outputs:

```text
firestore.rules source file or documented export path
rules test fixture strategy
emulator/staging validation command
rollback procedure
production deployment approval gate
```

Rules snapshot work must avoid printing production private document paths or IDs. Use synthetic fixtures for tests.

---

## 6. Phase 2 — create-time validation

Next hardening target should be create-time author/owner validation because it reduces future data integrity drift.

Expected checks:

```text
trees create requires authenticated user
request.resource.data.ownerId matches authenticated user
comments create requires authenticated user
request.resource.data.userId or authorId matches authenticated user
```

Risks:

- existing clients may use a different owner/author field name;
- backend service-account paths may bypass rules and need separate server-side validation;
- old data may be missing expected fields.

Verification should use emulator/staging where possible before production rules update.

---

## 7. Phase 3 — private tree read boundary

Next hardening target should enforce visibility-aware read access.

Expected behavior:

```text
public tree: anonymous public read allowed for fields intended to be public
private tree: owner/admin read only
missing visibility: handled by product-approved default or migration plan
```

Important policy dependency:

- LoveBud current product policy is public-by-default until private entitlement exists.
- Private rows must be audited under #674 before rules assume a stable private entitlement model.

Do not deploy a rule that makes existing owner data inaccessible because a legacy visibility field is missing.

---

## 8. Phase 4 — comments visibility inheritance

Comments should not be public if their parent tree is private.

Expected behavior:

```text
comment read allowed only when parent tree is public or requester has owner/admin access
comment create allowed only for authenticated author on an allowed parent tree
comment update/delete allowed only by author/admin or a separately approved owner moderation path
```

If comments are not active, record status as `INACTIVE` rather than inventing behavior.

---

## 9. Phase 5 — production deployment gate

Before production rules deployment, record:

```text
[Firestore Rules Deploy Gate]
Rules source tracked: YES/NO
Emulator/staging validation: PASS/FAIL/NOT_RUN
Production deployment approved by CTO: YES/NO
Previous rules version captured: YES/NO
Rollback path documented: YES/NO
Expected affected collections: trees/comments/other
Public read smoke path: READY/NOT_READY
Owner read/write smoke path: READY/NOT_READY
Monitoring path: READY/NOT_READY
Secret/private ID exposure: NO
Final judgment: PASS/PARTIAL/BLOCKED
```

Do not deploy rules from local console changes without a recoverable source-of-truth path.

Rollback should restore the prior known-good rules version. It must not require printing service-account credentials or private document IDs.

---

## 10. Test matrix

Minimum hardening test matrix:

```text
anonymous reads public tree: ALLOW/DENY/NOT_VERIFIED
anonymous reads private tree: DENY/ALLOW/NOT_VERIFIED
owner reads own private tree: ALLOW/DENY/NOT_VERIFIED
non-owner reads private tree: DENY/ALLOW/NOT_VERIFIED
authenticated user creates tree for self: ALLOW/DENY/NOT_VERIFIED
authenticated user creates tree for another owner: DENY/ALLOW/NOT_VERIFIED
anonymous creates tree: DENY/ALLOW/NOT_VERIFIED
comment read on public tree: ALLOW/DENY/NOT_VERIFIED
comment read on private tree by anonymous: DENY/ALLOW/NOT_VERIFIED
comment create by authenticated author: ALLOW/DENY/NOT_VERIFIED
comment create spoofing another author: DENY/ALLOW/NOT_VERIFIED
```

Use synthetic IDs in tests or emulator fixtures. Do not report real production IDs.

---

## 11. Migration risks

| Risk | Mitigation |
| --- | --- |
| Missing visibility field | Audit existing data, backfill defaults only with approval |
| Existing private/grandfathered data | Coordinate with #674 before enforcing private entitlement assumptions |
| Client query failures | Verify active client direct Firestore usage and 403 handling |
| Admin operations | Confirm Admin SDK/service-account paths remain server-side and not client-exposed |
| Public Browse/Search compatibility | Keep public read paths explicitly tested |
| Console-only rules | Add tracked source and rollback procedure before production change |

---

## 12. Non-goals for this planning PR

This document does not:

- deploy Firestore Rules;
- change Firebase Console settings;
- add service-account credentials;
- change Cloudflare/Modal runtime code;
- change client Auth behavior;
- mutate production data;
- implement private entitlement;
- implement comments;
- close #281.

---

## 13. Closure criteria for #281

Issue #281 can move toward closure only after:

1. Firestore Rules source-of-truth is tracked or the console-only process is replaced by a durable export/deploy workflow.
2. Owner and visibility boundaries are implemented in rules.
3. Comment visibility inheritance is implemented or comments are explicitly inactive/not applicable.
4. Create-time owner/author validation is implemented.
5. Emulator/staging or equivalent rules validation passes.
6. Production deployment, if needed, is explicitly approved and safely reported.
7. No restricted values or private identifiers are exposed.

A docs-only planning PR can make the issue implementation-ready, but it is not a security fix by itself.

---

## 14. Related documents

- `docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md`
- `docs/security/FIREBASE_DEPLOYMENT_SECRET_POSTURE_RUNBOOK.md`
- `docs/product/PUBLICATION_AND_PRIVACY_UX_POLICY.md`
- `docs/engineering/BROWSE_FILTER_VS_PUBLICATION_GUARD.md`
- Issue #266
- Issue #281
- Issue #674
