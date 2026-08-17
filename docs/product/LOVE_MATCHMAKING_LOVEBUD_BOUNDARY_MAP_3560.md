# Love Matchmaking — LoveBud Boundary Map (Phase-0)

**Issue:** #3560
**Status:** Phase-0 boundary contract — documentation only.
**Purpose:** Explicitly separate LoveBud-native capabilities from Love Matchmaking capabilities, and define only the shared-contract areas that may cross the boundary.

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Boundary principle

```text
LoveBud != Love Matchmaking
PUBLIC_VISIBILITY != MATCHING_CONSENT
MATCH != MESSAGE_PERMISSION
PRIVATE_TREE_OR_MOMENT -> matching input = 0
DIRECT_SHARED_DATABASE_COUPLING = NO (default)
```

LoveBud is where a person records what they loved, remembered, and felt. Love Matchmaking is a separate relationship-discovery experience that consumes **explicitly consented, derived signals** through defined contracts — never by reading LoveBud's database directly.

## 2. LOVEBUD NATIVE (stays in LoveBud)

```text
- LoveTree recording (trees, moments, emotions, notes, tags, interpretations)
- public moment save/remix with attribution (LoveTree-native reuse)
- Tree/Moment similarity discovery (who resonated with the same public moment)
- self-analysis / explainability of one's own records
- matching-consent control entry point (the user controls what may be exported)
```

These are LoveBud features and must be implemented and validated as LoveBud features (Phase 1 in the roadmap), independent of Love Matchmaking.

## 3. LOVE MATCHMAKING (belongs to the separate product)

```text
- resonance profile (derived from consented signals)
- relationship intent selection (friendship / fandom peer / creative / peer / optional romantic)
- person discovery
- explainable match
- limited profile preview
- connection request
- bilateral acceptance
- connection state
- block / hide / report / pause
- matchmaking-specific moderation and appeal
- later messaging (only after safety readiness)
```

## 4. SHARED CONTRACT CANDIDATES (the only allowed crossing)

```text
- stable account reference (opaque, no raw identity leakage)
- explicitly consented public signal export (versioned, bounded)
- revocation / deletion propagation (consent withdrawal removes signal inputs)
- versioned API/event contract (no direct table access)
```

Every shared contract must be:

```text
explicit consent
bounded scope
versioned
revocable
deletable
auditable (sanitized)
```

## 5. Consent semantics

```text
public visibility alone        != matching consent
separate explicit opt-in        = required for matching participation
per-tree / per-moment control   = user chooses which records may contribute
pause discovery                 = stops matching from using signals
withdraw consent                = removes signal inputs (with propagation)
remove inaccurate derived profile = user correction path required
```

## 6. Private data rule

```text
PRIVATE_TREE_OR_MOMENT -> matching input = 0 (hard exclusion, fail closed)
```

A private LoveTree or private moment never contributes to a resonance profile, regardless of any other setting. Raw private text is never exposed to another user to explain a match.

## 7. What this document does NOT authorize

```text
- shared database schema between LoveBud and Love Matchmaking
- matching reading LoveBud production data directly
- treating public data as matching consent
- any runtime implementation
- creating a repository or package
```

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
