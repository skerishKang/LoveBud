# Issue #299 Closure Disposition

## Issue Summary

Issue #299: Plan Firebase config global contract migration after audit

## Resolution Status

**OPEN** - Planning and staged implementation tracking issue

## Implementation History

### Phase 1: Audit/Documentation Baseline (COMPLETED)

- **PR**: #296
- **Document**: docs/engineering/FIREBASE_CONFIG_CONTRACT.md
- **Scope**: docs-only audit/documentation baseline
- **Runtime, UI, API, Auth, Search, Editor behavior**: unchanged

### Phase 2: Migration Strategy Documentation (COMPLETED)

- **PR**: #374
- **Merge Commit**: 97dc73003d7ca99f60ce46e7d9a650dac7a1e54c
- **Summary**:
  - Updated Firebase config/global migration strategy with clearer option matrix
  - Added migration sensitivity for current Firebase/Auth globals
  - Clarified Option A/B/C/D tradeoffs and staged path
  - Preserved docs-only scope
  - No Firebase config values changed
  - No JS/CSS/page/runtime/script order/Auth/Login behavior changed
  - No PR #7/prototype/reference/demo/variant paths touched

## Current Status

Issue #299 remains open for future staged work:

1. Test-only current global symbol contract coverage
2. Optional compatibility namespace proposal after tests
3. Any direct global usage reduction only after separate approval and production-equivalent smoke

## Guardrails (Preserved)

- Do not change Firebase config values
- Do not change Firebase SDK script order
- Do not remove initFirebase() without a compatibility layer
- Preserve initialization idempotency
- Preserve auth-ready callback behavior
- Do not treat pending auth as signed-out
- Do not combine this with Login UI, protected route, settings return navigation, or editor runtime changes
- Do not modify PR #7 or prototype/reference/demo/variant paths

## Required Verification Before Implementation

- Login page smoke
- My Trees auth-pending smoke
- Editor protected-page smoke
- Settings auth/return navigation smoke
- Public header auth UI smoke
- Contract tests if a namespace/helper layer is added

## Suggested PR Sequence (Preserved)

1. ✅ Planning-only issue review
2. ✅ Optional docs update for chosen migration strategy (PR #374)
3. ⏳ Test-only contract coverage for current global symbols
4. ⏳ Small compatibility namespace PR, if approved
5. ⏳ Only after verification, consider reducing direct global usage

## Non-Goals (Preserved)

- No Firebase Console change
- No provider/config/security rules change
- No Auth/Login behavior change in the planning phase
- No ES module conversion without explicit approval

## Related

- Follow-up from #220
- Completed by #296 for audit/documentation baseline
- Migration strategy documented by #374
