# Love Matchmaking — UX Concept (Phase-0)

**Issue:** #3560
**Status:** Phase-0 UX concept — structural definition only; no code, no HTML, no UI implementation.

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Design identity

Love Matchmaking may establish a **visual identity distinct from LoveBud/LoveTree**. Simple LoveTree UI replication is not the goal. The experience should feel like a separate, deliberate product surface even when reusing shared concepts.

## 2. Required surfaces

```text
1. Matchmaking opt-in onboarding
2. Resonance profile
3. Signal control
4. Discover
5. Explainable match card
6. Limited profile preview
7. Connection request
8. Mutual acceptance
9. Block / hide / report
10. Later messaging entry (only after safety readiness)
```

## 3. Surface details (conceptual)

### 3.1 Opt-in onboarding
- separate explicit opt-in (public visibility alone is never consent)
- relationship intent selection (friendship / fandom peer / creative / peer / optional romantic)
- signal control introduction (which records may contribute)

### 3.2 Resonance profile
- derived, user-visible summary of consented signals
- user can view and correct/remove inaccurate derived signals
- no single raw numeric score as the centerpiece

### 3.3 Signal control
- per-tree / per-moment toggle for matching contribution
- pause discovery; withdraw consent (with propagation)

### 3.4 Discover
- explainable suggestions; no demographic-first ranking
- truthful no-match/low-confidence states for cold start

### 3.5 Explainable match card
Card must communicate:
```text
- why this person was suggested (shared signals)
- which information was used (bounded categories)
- which information was NOT used or shared (private text, non-consented signals)
- user control (hide / block / report / adjust signals)
```
Example:
```text
"You both recorded four moments from the same era."
"Your emotional flow is similar: waiting -> excitement -> pride."
"Both of you respond more strongly to interviews and growth stories."
"Six moments express similar meaning across different languages."
```

### 3.6 Limited profile preview
- bounded, consented fields only
- private records never previewed

### 3.7 Connection request / mutual acceptance
- bilateral; no contact before acceptance

### 3.8 Block / hide / report
- always available; report includes an appeal path

### 3.9 Later messaging entry
- appears only when match + mutual acceptance + safety state are all valid

## 4. UX principles

```text
explainable, not magical
opt-in, not default-on
private, not leaky
intent-explicit, not assumed-romantic
safety-first, not connection-first
```

## 5. Non-authorization

No code, no HTML, no prototype runtime, no LoveBud UI changes are authorized by this document.

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
