# Love Matchmaking — Validation Roadmap (Phase-0)

**Issue:** #3560
**Status:** Phase-0 roadmap — documentation only; no phase is activated by this document.

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Phase overview

```text
Phase 0  Product / architecture / safety contracts          (this package)
Phase 1  LoveBud-native foundations
Phase 2  Offline synthetic resonance prototype
Phase 3  Explicitly consented private prototype
Phase 4  Bounded connection requests + safety
Phase 5  Messaging only after safety readiness
```

## 2. Phase gates

### Phase 0 — Product / architecture / safety contracts

```text
ENTRY CONDITIONS:      none (this package)
ALLOWED DATA:          none (documentation only)
SUCCESS CRITERIA:      boundary ADR, signal contract, safety governance, UX concept,
                       child-issue plan all exist and are reviewed
STOP CONDITIONS:       unresolved consent/safety contradiction
PRODUCTION AUTHORITY:  NO
```

### Phase 1 — LoveBud-native foundations

```text
ENTRY CONDITIONS:      Phase-0 review accepted
ALLOWED DATA:          LoveBud public-eligible records + explicit consent controls
SUCCESS CRITERIA:      public moment save/remix + attribution; Tree/Moment similarity
                       discovery; self-analysis/explainability; matching-consent controls
STOP CONDITIONS:       privacy/consent boundary violated
PRODUCTION AUTHORITY:  separate owner approval per feature
```

### Phase 2 — Offline synthetic resonance prototype

```text
ENTRY CONDITIONS:      Phase-1 foundations validated
ALLOWED DATA:          synthetic data OR explicitly consented test data ONLY
SUCCESS CRITERIA:      similarity signals produce understandable and useful matches
                       on synthetic/consented data; explainability contract validated
STOP CONDITIONS:       Production matching activated (forbidden); real user data used without consent
PRODUCTION AUTHORITY:  NO — Production matching = NO
```

### Phase 3 — Explicitly consented private prototype

```text
ENTRY CONDITIONS:      Phase-2 success + architecture boundary approved
ALLOWED DATA:          explicitly consented user signals only; private records excluded
SUCCESS CRITERIA:      bounded separate-product prototype works under the approved boundary
STOP CONDITIONS:       consent/revocation propagation failure
PRODUCTION AUTHORITY:  separate owner approval
```

### Phase 4 — Bounded connection requests + safety

```text
ENTRY CONDITIONS:      Phase-3 success + safety/moderation contracts operational
ALLOWED DATA:          consented signals; bilateral request state
SUCCESS CRITERIA:      bilateral acceptance, block/report/hide, limited profile preview,
                       minor-safety policy conditions satisfied
STOP CONDITIONS:       abuse/harassment controls not operational; minor-safety unready
PRODUCTION AUTHORITY:  separate owner approval
```

### Phase 5 — Messaging only after safety readiness

```text
ENTRY CONDITIONS:      Phase-4 success + messaging readiness gate (safety, consent,
                       moderation, connection-state contracts all operational)
ALLOWED DATA:          matched + mutually accepted + safety-valid users
SUCCESS CRITERIA:      bounded messaging with block/report/appeal working end to end
STOP CONDITIONS:       any safety gate regression
PRODUCTION AUTHORITY:  separate owner approval
```

## 3. Hard invariants across all phases

```text
Production matching in Phase 2:            NO
private records as matching input:         NO
public visibility as matching consent:     NO
messaging before safety readiness:         NO
sensitive-trait inference:                 NO
```

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
