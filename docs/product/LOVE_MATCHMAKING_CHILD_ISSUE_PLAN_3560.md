# Love Matchmaking — Child Issue Plan (Phase-0)

**Issue:** #3560
**Status:** Phase-0 plan only — **no child Issue is created by this document** (GitHub write = none).

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Splitting rule

No mixed implementation PR. Each child is a small, independent work package with explicit dependencies and stop conditions.

## 2. Child packages

### Child A — LoveBud consented resonance export contract
```text
PURPOSE:             define the versioned, consent-scoped export contract from LoveBud
DEPENDENCIES:        Phase-0 boundary map
SOURCE SCOPE:        contract doc + focused contract tests
NON-SCOPE:           matching runtime; derived profiles
SECURITY/PRIVACY:    private records excluded; consent + revocation propagation
ACCEPTANCE:          contract test proves private/consent exclusions
STOP CONDITION:      consent propagation undefined
```

### Child B — Derived signal schema / privacy boundary
```text
PURPOSE:             schema for consented derived signals; privacy boundary
DEPENDENCIES:        Child A
SOURCE SCOPE:        schema contract + privacy-boundary tests
NON-SCOPE:           model implementation
SECURITY/PRIVACY:    no sensitive-trait fields; bounded derived features only
ACCEPTANCE:          schema rejects non-consented/private inputs
STOP CONDITION:      private input leak path
```

### Child C — Offline similarity engine prototype
```text
PURPOSE:             synthetic-data offline prototype of signal layers (L1–L7)
DEPENDENCIES:        Child B; Phase-2 roadmap gate
SOURCE SCOPE:        offline prototype + synthetic fixture tests
NON-SCOPE:           Production matching; real user data
SECURITY/PRIVACY:    synthetic/consented data only
ACCEPTANCE:          explainability outputs match the signal contract
STOP CONDITION:      Production data use or unexplainable output
```

### Child D — Explainability contract
```text
PURPOSE:             user-visible explanation format (why/which used/which not/control)
DEPENDENCIES:        Child C
SOURCE SCOPE:        contract + focused tests
NON-SCOPE:           raw text exposure
SECURITY/PRIVACY:    RAW_PRIVATE_TEXT_EXPOSURE = FORBIDDEN
ACCEPTANCE:          explanation never includes private text
STOP CONDITION:      any raw-text leak in generated explanation
```

### Child E — Matchmaking account/interoperability contract
```text
PURPOSE:             account relationship + interop between LoveBud identity and matchmaking
DEPENDENCIES:        ADR (Option A direction)
SOURCE SCOPE:        interop contract + tests
NON-SCOPE:           shared DB coupling
SECURITY/PRIVACY:    opaque stable reference only; no raw identity
ACCEPTANCE:          no direct DB coupling; versioned contract
STOP CONDITION:      identity/account ambiguity
```

### Child F — Connection-state model
```text
PURPOSE:             bilateral connection request/acceptance state machine
DEPENDENCIES:        Child E
SOURCE SCOPE:        state model + deterministic tests
NON-SCOPE:           messaging
SECURITY/PRIVACY:    contact only after bilateral acceptance
ACCEPTANCE:          MATCH != MESSAGE_PERMISSION enforced
STOP CONDITION:      contact before acceptance
```

### Child G — Block/report/moderation contract
```text
PURPOSE:             block, hide, report, appeal, spam prevention contract
DEPENDENCIES:        Child F
SOURCE SCOPE:        contract + focused tests
NON-SCOPE:           full moderation console
SECURITY/PRIVACY:    sanitized moderation evidence only
ACCEPTANCE:          block propagates; appeal path exists
STOP CONDITION:      abuse/harassment controls absent
```

### Child H — Bounded UX prototype
```text
PURPOSE:             bounded separate-product UX prototype (distinct visual identity)
DEPENDENCIES:        Children A–G contracts
SOURCE SCOPE:        prototype surface (concept only until owner approval)
NON-SCOPE:           LoveBud UI redesign; full product
SECURITY/PRIVACY:    limited preview; private records never shown
ACCEPTANCE:          explainable match card renders per contract
STOP CONDITION:      privacy leak in preview
```

### Child I — Messaging readiness gate
```text
PURPOSE:             gate that messaging may open only after safety readiness
DEPENDENCIES:        Children F/G + minor-safety policy
SOURCE SCOPE:        readiness gate contract + tests
NON-SCOPE:           messaging implementation
SECURITY/PRIVACY:    minor-safety + consent + moderation all required
ACCEPTANCE:          gate blocks messaging until all prerequisites valid
STOP CONDITION:      any prerequisite missing
```

## 3. Ordering and dependencies

```text
A -> B -> C -> D   (signal path)
E -> F -> G        (identity/connection/safety path)
H (UX) depends on A–G contracts
I (messaging) depends on F + G + minor-safety policy; last
```

## 4. Non-authorization

```text
- no child Issue created in this session
- no runtime implementation
- no repository creation
```

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
