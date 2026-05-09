# Firestore Rules Hardening Rollout Plan

## Purpose

Define a staged rollout and verification plan for hardening Firestore Rules around private tree access control.

This document is planning-only. It does not change Firestore Rules, Firebase Console settings, client code, backend code, deployment configuration, or data.

Related issues:

- Security hardening: #281
- Firebase posture verification: #266

---

## Problem statement

The current security concern is that private tree access must be enforced at the database rules layer, not only by client behavior or backend conventions.

The desired policy is:

- public trees remain publicly readable
- private trees are readable only by owner/admin
- tree creation validates owner identity
- comments inherit parent tree visibility policy
- comment creation validates author identity
- rules become repository-tracked source of truth

---

## Non-goals

- No Firestore Rules change in this PR
- No Firebase Console change in this PR
- No client-side behavior change
- No Modal/API/backend change
- No Auth provider/config change
- No Storage Rules change
- No migration script in this PR
- No PR #7/prototype/reference/demo/variant changes

---

## Rollout phases

### Phase 0 — Baseline verification

Confirm and document current state before any rule change:

- current Firestore Rules source
- whether rules are console-only or repository-tracked
- tree visibility field shape
- owner/admin field shape
- comments parent relationship
- existing private tree data shape
- whether missing visibility fields exist

Output:

- baseline audit result
- staging/production separation decision
- rollback owner and procedure

### Phase 1 — Repository source-of-truth setup

Add repository-tracked rules without changing production behavior yet, if possible.

Output candidates:

- `firestore.rules`
- rules deployment notes
- rules test harness decision

Guardrail:

- do not deploy new restrictive rules before tests and data compatibility are reviewed

### Phase 2 — Create-time validation

First implementation hardening candidate:

- tree create requires authenticated user
- tree create requires `ownerId == request.auth.uid`
- comment create requires `userId == request.auth.uid`

Why first:

- lower risk than changing read visibility
- prevents newly created malformed ownership data

### Phase 3 — Private tree read boundary

Add private tree read control:

- public tree: public read allowed
- private tree: owner/admin read only
- missing visibility: handled by explicit migration/default policy

Required before deployment:

- migration plan for trees missing visibility
- client behavior for permission-denied responses
- owner/admin access tests

### Phase 4 — Comments visibility inheritance

Make comment reads inherit parent tree visibility.

Required before deployment:

- confirm comment has reliable parent tree reference
- test public tree comment read
- test private tree comment denial for non-owner
- test owner/admin access

### Phase 5 — Monitoring and production rollout

Roll out with monitoring:

- record deployment time
- monitor permission-denied spikes
- test core public browse/detail paths
- test private owner/editor paths
- confirm rollback procedure is ready

---

## Required test matrix

| Area | Public anonymous | Auth owner | Auth non-owner | Admin |
|---|---:|---:|---:|---:|
| public tree read | allow | allow | allow | allow |
| private tree read | deny | allow | deny | allow |
| tree create ownerId=self | deny | allow | allow for own uid only | allow if policy permits |
| tree create ownerId=other | deny | deny | deny | policy decision |
| comment read on public tree | allow | allow | allow | allow |
| comment read on private tree | deny | allow | deny | allow |
| comment create userId=self | deny | allow | allow for own uid only | allow if policy permits |
| comment create userId=other | deny | deny | deny | policy decision |

---

## Data compatibility checks

Before restrictive read rules:

- count trees missing `visibility`
- count trees missing `ownerId`
- identify private trees with malformed owner data
- confirm comments can resolve parent tree visibility
- define default behavior for missing visibility

Recommended policy for missing visibility:

- do not assume missing means public without product/security approval
- migrate data before enforcing stricter reads when needed
- document any grandfathered behavior explicitly

---

## Rollback plan requirements

Before deployment, define:

- who can deploy rules
- who can rollback rules
- where the previous rules version is stored
- how to verify rollback succeeded
- what user-facing errors indicate rule regression

---

## Client compatibility requirements

Client behavior must handle rule denials gracefully:

- public browse/detail should not break for public trees
- private tree owner flows should continue to work
- non-owner private tree access should show a clear unavailable/permission state
- Auth pending must not be treated as permanent denial

---

## Suggested future PR split

1. Baseline audit document for current rules and data shape.
2. Repository rules source-of-truth setup.
3. Rules test harness or documented test procedure.
4. Create-time validation rule change.
5. Private tree read boundary rule change.
6. Comment visibility inheritance rule change.
7. Production rollout report.

---

## Acceptance criteria for this planning stage

- Rollout phases are explicit.
- Tests are separated by access role.
- Data compatibility checks are listed.
- Rollback requirements are documented.
- No production rule change occurs from this document.

---

Refs #281
Refs #266
