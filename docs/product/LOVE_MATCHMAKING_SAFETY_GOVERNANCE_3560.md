# Love Matchmaking — Safety & Governance Model (Phase-0)

**Issue:** #3560
**Status:** Phase-0 safety/governance contract — documentation only.

Refs #3560
Refs #3425
Refs #1882 — Keep OPEN.

## 1. Principle

Matching is opt-in and **fail closed**. Every control below is required before any open connection or messaging flow is possible.

## 2. User controls (required)

```text
- explicit opt-in to matching participation
- per-tree / per-moment signal control
- consent withdrawal (removes signal inputs, with propagation)
- pause discovery
- hide (remove a suggestion without blocking)
- block (no further discovery/contact from that user)
- report (abuse/harassment)
- appeal (reconsider a moderation decision)
```

## 3. Minor / adult safety

```text
MINOR_ADULT_SAFETY_POLICY_REQUIRED_BEFORE_OPEN_CONNECTION = REQUIRED
```

Current stage: unrestricted minor/adult matching is **not** permitted. An explicit minor-safety policy (age verification approach, separation rules, restricted surfaces) must be defined and reviewed **before** any open connection or messaging flow is opened.

## 4. Connection and messaging gate

```text
MATCH != MESSAGE_PERMISSION

connection request
-> mutual acceptance
-> safety state valid
-> messaging eligibility
```

Messaging is only available after:

```text
- bilateral acceptance exists
- safety state is valid
- minor-safety policy conditions are satisfied
- moderation/abuse tooling is operational
```

Unrestricted direct messaging is never the starting point.

## 5. Spam and harassment prevention (future requirements)

```text
- bounded request rates
- duplicate/abuse detection
- block propagation (no contact through alternate surfaces)
- report triage and review
- appeal path
- sanitized moderation evidence (no raw private content in shared logs)
```

## 6. Moderation and appeal boundary

```text
- moderation decisions are reviewable and appealable
- automated decisions are bounded and human-reviewable
- raw private text is not used as public moderation evidence
```

## 7. Data deletion propagation

```text
- account deletion / consent withdrawal propagates to derived resonance signals
- derived profiles are removed or anonymized per contract
- revocation is bounded and observable (sanitized status only)
```

## 8. Non-authorization

```text
- no unrestricted DM
- no friends/follow implementation
- no open connection for minors/adults before policy review
- no sensitive-trait inference
- no Production data analysis
```

Refs #3560
Refs #3425 — Keep OPEN.
Refs #1882 — Keep OPEN.
