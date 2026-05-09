# Firebase API Key Restriction Runbook

## Purpose
- Track verification of Firebase Web API key restrictions as follow-up for #266.
- Separate from actual Google Cloud Console changes.

## Owner Prerequisites
- Owner or authorized team member must verify API key restrictions in Firebase Console or GCP.

## Verification Checklist
- HTTP referrer restriction posture
- API usage restriction posture
- Production/preview domain policy

## Evidence Recording Policy
- OK: Restricted / Unrestricted / Not verified / Blocked by access
- NOT OK: key value, prefix/suffix, screenshots

## Decision Outcomes
- VERIFIED_RESTRICTED
- NEEDS_RESTRICTION
- BLOCKED_BY_OWNER_ACCESS

## Follow-Up Path
- Console change requires explicit CTO approval
- No repo config change from this PR

## Relationship to #266 and #281
- #266 remains open
- #281 not duplicated