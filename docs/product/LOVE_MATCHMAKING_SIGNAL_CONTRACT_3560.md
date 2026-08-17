# Love Matchmaking — Matching Signal Contract (Phase-0)

**Issue:** #3560
**Status:** Phase-0 signal contract proposal — documentation only; no feature/model implementation.

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Principle

Matching is based on **recorded, explicitly consented, derived signals** — never on a single raw score, and never on demographic ranking. A raw score alone is insufficient: users must be able to understand why a connection was suggested.

## 2. Signal layers

```text
L1  Content overlap
      same source, artist, topic, event, era, or work

L2  Moment overlap
      same or semantically equivalent scene, quote, event, or turning point

L3  Emotional interpretation
      similar emotions, meanings, motivations, and personal reactions

L4  Narrative trajectory
      similar sequences: discovery -> immersion -> waiting -> disappointment -> return -> pride

L5  Attention pattern
      recurring preference: interviews, performances, behind-the-scenes, growth stories,
      humor, comfort, and other recurring forms

L6  Temporal evolution
      how attachment and emotion change over time

L7  Multilingual semantic similarity
      records in different languages expressing similar meaning
```

The system must distinguish:

```text
same content        != same moment        != same interpretation
!= similar emotional trajectory
```

## 3. User-visible explanation vs internal derived features

```text
USER_VISIBLE_EXPLANATION (example):
  "You and this person both recorded four moments from the same era."
  "Your emotional flow is similar: waiting -> excitement -> pride."
  "Both of you respond more strongly to interviews and growth stories than to performance clips."
  "Six moments express similar meaning across different languages."

INTERNAL_DERIVED_FEATURES (never shown raw):
  bounded, sanitized, versioned feature vectors/signals computed only from consented inputs
```

Explanation must never require exposing raw private text to another user.

## 4. Score display policy

```text
EXACT_MATCH_SCORE_DISPLAY = DECISION_REQUIRED (exact score, bands, or shared themes only —
  reviewed before any implementation; default bias toward bands/themes, not a single numeric score)
```

## 5. Prohibitions

```text
RAW_PRIVATE_TEXT_EXPOSURE = FORBIDDEN
SENSITIVE_TRAIT_INFERENCE = FORBIDDEN unless separately policy-reviewed
  (no inference of protected or sensitive traits as matching labels)
DEMOGRAPHIC_FIRST_RANKING = FORBIDDEN
DESTINY_OR_COMPATIBILITY_GUARANTEE = FORBIDDEN
```

## 6. Consent and input rule

```text
only explicitly consented, public-eligible signals may contribute
private trees/moments -> input = 0
public visibility != matching consent
per-tree / per-moment signal control required
consent withdrawal removes inputs (with propagation)
```

## 7. Cold-start behavior

```text
INSUFFICIENT_RECORDS:
  - minimum evidence threshold required before a resonance profile is usable for matching
  - below threshold: truthful no-match/low-confidence state; never fabricated matches
  - new users see guidance on what would make matching meaningful (e.g., more recorded moments)

NO_MATCH / LOW_CONFIDENCE:
  - explicit, not forced
  - never a false "no one like you exists" framing

MINIMUM_EVIDENCE:
  - exact threshold = future policy decision, informed by Phase-2 offline validation
```

## 8. Explainability requirement (example card content)

```text
- why this person was suggested (shared signals)
- which information was used (bounded categories)
- which information was NOT used / not shared (private text, non-consented signals)
- user control (hide, block, report, pause, adjust signals)
```

## 9. Non-authorization

This contract defines future feature/derived-signal semantics only. It authorizes no model, no ranking implementation, no Production data analysis, and no database schema.

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
