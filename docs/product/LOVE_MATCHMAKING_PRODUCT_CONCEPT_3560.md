# Love Matchmaking — Product Concept (Phase-0)

**Issue:** #3560
**Status:** Phase-0 product concept — documentation only; no runtime implementation.
**Boundary:** This document defines product intent. Architecture, data, and safety contracts are defined in the sibling Phase-0 documents (`LOVE_MATCHMAKING_PRODUCT_BOUNDARY_ADR_3560.md`, `LOVE_MATCHMAKING_SIGNAL_CONTRACT_3560.md`, `LOVE_MATCHMAKING_SAFETY_GOVERNANCE_3560.md`, `LOVE_MATCHMAKING_UX_CONCEPT_3560.md`).

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Working product statement

```text
LoveBud records:   "What did I love, remember, and feel?"
Love Matchmaking:  "Who has lived through a meaningfully similar emotional and narrative
                    pattern, and do we both want to connect?"
```

Love Matchmaking matches people through the moments and emotional journeys they actually recorded — not primarily through age, gender, nationality, location, or a manually written profile.

## 2. Not a dating app

Love Matchmaking is not a dating app and does not claim dating compatibility. Relationship intent is user-chosen and separable:

```text
friendship
fandom peer
creative collaboration
peer support
romantic possibility (opt-in, optional)
```

The product must allow the user to choose intent(s) and must not assume romantic intent by default.

## 3. Core matching principle

Matching centers on **recorded emotional/narrative resonance**, not demographics or shared URLs.

The system must distinguish:

```text
same content        (liking the same thing)
!= same moment      (selecting the same moment)
!= same interpretation (interpreting it similarly)
!= similar emotional trajectory (following a similar long-term emotional path)
```

## 4. Target user

Primary user: a person who already records meaningful content, selected moments, emotions, notes, tags, and interpretations in LoveBud (LoveTree), and who wants to find other people whose recorded emotional journeys genuinely resonate — without being reduced to demographic filters or a dating profile.

## 5. User problem

- Liking the same artist/content is common; finding people who **interpret and feel** in a similar way is rare.
- Existing social/dating products rank by demographics, proximity, or self-authored profiles.
- Users have no safe, explainable way to discover "people like me in how I love and remember."

## 6. Differentiated value

```text
demographic-first ranking: NO
self-authored profile as primary basis: NO
recorded emotional/narrative resonance: PRIMARY
explainable similarity: REQUIRED
bilateral opt-in connection: REQUIRED
```

## 7. Primary journeys

```text
J1  Consent and resonance profile setup
J2  Discovery with explainable match cards
J3  Limited profile preview
J4  Connection request → mutual acceptance
J5  Connection state (friendship/fandom/creative/peer/optional romantic)
J6  Block / hide / report / pause / signal control
J7  Later messaging entry (only after safety readiness)
```

## 8. Cold-start problem

- Users with few LoveBud records need a defined path (see `LOVE_MATCHMAKING_SIGNAL_CONTRACT_3560.md` cold-start section).
- Minimum evidence required before meaningful matching; no-match/low-confidence must be truthful, not forced.

## 9. Success / failure hypotheses

```text
H1 (success):  users understand why a match was suggested and can act on it safely
H2 (success):  connection intent (friendship/fandom/creative/peer) is chosen by users, not assumed
H3 (success):  matched users report the resonance explanation matched their own sense of similarity
F1 (failure):  users cannot understand why they were matched → distrust
F2 (failure):  private or non-consented data leaks into matching → loss of trust and safety
F3 (failure):  minority/minor-safety protections are absent → product must not open
```

## 10. Prohibited overclaiming

```text
destiny:                    NO
soulmate certainty:         NO
psychological diagnosis:    NO
objective compatibility:    NO
dating guarantee:           NO
```

## 11. Phase-0 deliverable scope

This document is part of the Phase-0 package. It authorizes no runtime implementation, no repository creation, no database change, and no Production data processing.

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
