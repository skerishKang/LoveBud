# Firestore Rules Hardening Rollout Plan

> **Version:** 1.0
> **Last updated:** 2026-04-29
> **Related issue:** #281

---

## 1. Problem

Private tree/comment access boundary needs reinforcement at the Firestore Rules layer. Current implementation has gaps that could allow unauthorized access.

---

## 2. Current Known Gaps

| Gap | Current State | Risk |
|-----|---------------|------|
| Tree read | Unrestricted | Private trees potentially exposed |
| Tree create | Missing ownerId validation | Unauthorized ownership assignment |
| Comment read | Unrestricted | Comments inherit parent tree visibility incorrectly |
| Comment create | Missing userId validation | Unauthorized authorship attribution |
| Rules tracking | Not in repository | No version control, manual disaster recovery |

---

## 3. Desired Policy

### 3.1 Tree Access

- **Public tree read**: Allowed without auth (maintains browse/search)
- **Private tree read**: Owner or admin only (authentication required)
- **Tree create**: Validate `ownerId` matches authenticated user
- **Tree update/delete**: Owner validation enforced

### 3.2 Comment Access

- **Comment read**: Inherit parent tree visibility
  - If parent tree is public → comment readable
  - If parent tree is private → comment readable by owner/admin only
- **Comment create**: Validate `userId` matches authenticated user
- **Comment update/delete**: Author validation enforced

### 3.3 Repository-Tracked Rules

- Rules stored in `firestore.rules`
- Changes require PR review
- Emulator tests required before deployment

---

## 4. Rollout Phases

### Phase 0: Docs/Plan Only (Current)
- Document gaps and policy
- Define verification requirements
- No code/rules changes

### Phase 1: Repository Rules Snapshot + Tests
- Add `firestore.rules` to repository
- Document current production rules
- Add emulator-based rules tests
- **Non-breaking**: Rules not yet deployed

### Phase 2: Create-Time Validation
- Add `ownerId` validation on tree create
- Add `userId` validation on comment create
- **Risk**: Client create flows must pass auth token

### Phase 3: Private Tree Read Boundary
- Enforce owner/admin read on private trees
- **Risk**: Non-owner read queries will fail

### Phase 4: Comment Visibility Inheritance
- Read rules check parent tree visibility
- **Risk**: Comment read queries may break for non-owners

### Phase 5: Production Rollout
- Staging validation on fixed test slot
- Gradual production deployment
- Monitor for unauthorized access errors

---

## 5. Migration Risks

| Risk | Mitigation |
|------|------------|
| Missing visibility field | Audit existing data, backfill defaults |
| Existing private/grandfathered data | Grandfathered exception handling |
| Client query failures | Update client queries to handle 403 |
| Admin operations | Admin SDK bypasses rules |
| Public tree browse/search compatibility | Public read paths unchanged |

---

## 6. Verification Requirements

### 6.1 Emulator/Rules Tests
- Unauthorized read/write denial
- Public read pass
- Owner private read pass
- Non-owner private read deny
- Comment read inheritance verification

### 6.2 Fixed Test Slot Smoke
- Deploy to `test6` slot
- Verify public tree browse works
- Verify private tree owner read works
- Verify non-owner private read denied
- Verify comment visibility inheritance
- Verify create-time validation

---

## 7. Explicit Non-Goals

- No client-only security boundary
- No Firebase Console ad hoc change
- No Storage Rules change
- No auth provider/config change
- No product policy change without review

---

## 8. Related

- `docs/security/FIREBASE_CLIENT_CONFIG_POLICY.md` - Client config security policy
- `js/firebase-config.js` - Firebase client configuration
- Issue #281 - Firestore rules hardening tracker