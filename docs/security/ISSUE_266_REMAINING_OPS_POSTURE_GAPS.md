# Issue #266 Remaining Ops Posture Gaps

## Purpose

This document tracks the remaining operational security posture gaps identified during the partial verification of Issue #266 (Ops: Firebase Console and deployment secret posture verification). It serves as a follow-up tracker after the initial checklist and disposition documentation. This is a docs-only document; no Firebase Console, Google Cloud Console, Modal, or Netlify settings are changed here.

## Current Disposition

- Issue #266 remains **OPEN** in PARTIAL state.
- The Firestore Rules hardening gap is already tracked separately by Issue #281.
- Related PRs (#300, #376, #435, #438, #441) are docs/planning/checklist only — none of them modified Firebase Console, Firestore Rules, runtime code, workflows, or secrets.

## Remaining Gap A: Firebase API Key Restriction Hardening

**Owner:** Google Cloud Project/IAM Owner

**Verification needed:**
- Confirm HTTP referrer restrictions are configured for Firebase Web API key(s).
- Confirm API usage restrictions limit the key to only necessary Firebase/Google Cloud APIs.
- Verify authorized production/preview domains policy aligns with current deployment domains.

**Recording policy (FORBIDDEN):**
- Actual API key value.
- Key prefix/suffix.
- Credential screenshots.

**Possible outcomes:**
- `VERIFIED_RESTRICTED` — Restrictions are properly configured.
- `NEEDS_RESTRICTION` — Restrictions require hardening.
- `BLOCKED_BY_OWNER_ACCESS` — Insufficient access to verify.

## Remaining Gap B: Secret Rotation Owner/Cadence Documentation

**Owner:** Modal Secret Owner

**Verification needed:**
- Confirm the owner of `FIREBASE_SERVICE_ACCOUNT_JSON` secret in Modal.
- Confirm rotation owner and established rotation cadence.
- Optionally record last rotation metadata only if owner approves and no secret material is exposed.

**Recording policy (FORBIDDEN):**
- Service account JSON content.
- `private_key` field.
- `client_email` field.
- Any token/session/cookie values.
- Partial credential values.

**Possible outcomes:**
- `VERIFIED_OWNER_AND_CADENCE` — Ownership and cadence are documented.
- `NEEDS_ROTATION` — Secret requires immediate rotation.
- `NEEDS_OWNER_ASSIGNMENT` — No clear owner or cadence defined.
- `BLOCKED_BY_OWNER_ACCESS` — Insufficient access to verify.

## Remaining Gap C: Legacy Authorized Domain Cleanup Decision

**Owner:** Firebase Console / Auth Owner

**Verification needed:**
- Review Firebase Authentication authorized domains list.
- Identify legacy domains from old deployments (Netlify/Vercel/preview environments).
- Determine whether legacy domains are still required or candidates for removal.

**Note:** Actual domain removal is not part of this tracking document; only the decision posture is tracked here.

**Possible outcomes:**
- `VERIFIED_REQUIRED` — All listed domains are actively required.
- `NEEDS_LEGACY_DOMAIN_REMOVAL` — Legacy domains should be removed.
- `NEEDS_CTO_DECISION` — Requires policy decision on domain allow-list scope.
- `BLOCKED_BY_OWNER_ACCESS` — Insufficient access to verify.

## Relationship to Issue #281

- Issue #281 remains the dedicated Firestore Rules hardening follow-up.
- This document does not duplicate #281 scope.
- Issue #266 should not wait on #281 implementation details beyond the explicit linkage unless CTO requires full hardening before closure.

## Recommended Issue Handling

Issue #266 remains open until the remaining gaps are either:

- Verified and documented,
- Linked to dedicated follow-up issues (e.g., separate issues for API key restrictions, secret rotation, domain cleanup), or
- Explicitly accepted by CTO as tracked elsewhere.

Use `Refs #266` only. Use non-completing issue reference wording in related PR bodies unless CTO explicitly approves issue completion.

## Non-Goals

This document does not authorize or imply the following:

- No Firebase Console configuration changes.
- No Google Cloud API key restriction changes.
- No Modal secret rotation or modification.
- No Netlify/Vercel environment changes.
- No authorized domain removal.
- No Firestore Rules deployment or modification.
- No `firestore.rules`, `firebase.json`, or `.firebaserc` changes.
- No package or dependency changes.
- No GitHub Actions workflow changes.
- No runtime/client/backend code changes.
- No credential disclosure or secret value recording.
- No PR #7/prototype/reference/demo/variant changes.
