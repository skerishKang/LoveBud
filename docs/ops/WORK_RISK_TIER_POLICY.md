# Work Risk Tier Policy

> **Hard governance:** `MVP_AGENT_GOVERNANCE.md`
> **Execution roles:** `../project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **UI-specific classification:** `../project/UI_RAPID_ITERATION_LANE.md`

## Purpose

LoveBud uses risk-proportional implementation and verification. Small, reversible work moves quickly. Auth, backend, database, privacy, security, persistence, and destructive work remain strict.

This generic risk policy complements, but does not replace, the more precise UI classes U0/U1/U2/U3.

## Generic tiers

```text
Tier 1 — low risk / fast
Tier 2 — medium risk / focused
Tier 3 — high risk / strict
```

Risk controls evidence depth. It is not a permission system and does not create new hard blockers.

## Tier 1 — Low risk / fast

Characteristics:

- easy to inspect and revert;
- no user-data, auth, API, persistence, schema, privacy, or security impact;
- small isolated scope.

Examples:

- docs-only correction;
- copy text or translation;
- page-scoped spacing/color/typography;
- non-behavioral aria/title polish;
- isolated contract-test correction;
- clearly scoped dead-code/orphan-selector cleanup.

Default flow:

```text
Web CTO exact contract
→ separate Web Developer implementation
→ focused checks and CI classification
→ Web CTO exact-head review
→ expected-head squash merge
```

Local Validation is skipped unless a real local/environment gap exists.

Tier 1 does not automatically require:

- fixed slot or preview;
- full browser smoke;
- full repository suite;
- screenshots;
- long audit report;
- new child Issue;
- Local Validation.

For UI, use U0/U1 boundaries and escalation rules from `UI_RAPID_ITERATION_LANE.md`.

## Tier 2 — Medium risk / focused

Characteristics:

- user-facing behavior or structure can change;
- blast radius remains bounded;
- no auth/backend write/schema/privacy/security boundary.

Examples:

- DOM/card/loading/responsive structure;
- editor/mobile interaction without persistence changes;
- card routing or focus flow;
- shared frontend state with bounded impact;
- layout changes requiring browser evidence.

Default flow:

```text
Web CTO contract/design
→ Web Developer implementation
→ focused structural/runtime tests
→ conditional Local/browser evidence
→ Web CTO final review
```

For UI, this normally maps to U2 or a narrow U3-like runtime check.

## Tier 3 — High risk / strict

Characteristics:

- access control, stored data, runtime infrastructure, public/private exposure, security, privacy, schema, migration, or destructive behavior can change.

Examples:

- auth/session/login/logout;
- backend owner-write routes;
- database schema/migration;
- storage/security rules;
- visibility/entitlement policy;
- delete/destructive actions;
- API contracts and deployment/runtime infrastructure;
- large active-runtime refactors.

Default flow:

```text
Web CTO strict contract
→ Web Developer implementation and relevant tests
→ CI
→ exact-head Local Validation/environment evidence
→ Web CTO independent final review
→ expected-head squash merge
→ Production verification
```

Strict work may use small slices, but each slice must preserve policy and runtime contracts.

## UI mapping

| UI class | Generic tier | Default Local routing |
|---|---|---|
| U0 copy-only | Tier 1 | NOT_REQUIRED |
| U1 visual-only | Tier 1 | NOT_REQUIRED |
| U2 structural UI | Tier 2 | CONDITIONAL |
| U3 runtime-sensitive UI | Tier 2 or 3 depending on boundary | normally required when environment/runtime evidence is needed |

Any U3 touching auth, API writes, cache/storage persistence, privacy/security, or broad runtime contracts is Tier 3.

## Escalation

Upgrade when actual implementation reveals:

- JavaScript/event behavior not in the contract;
- DOM/focus/visibility/accessibility semantics;
- broad global/shared impact;
- auth/API/data/cache/storage;
- schema/migration/provider/deployment;
- privacy/security/destructive behavior.

Escalation changes the contract and required evidence; it does not require abandoning the current work or defaulting every task to Tier 3.

## Test selection

Select tests by affected behavior and blast radius.

```text
Tier 1: exact diff + focused syntax/static/contract
Tier 2: focused behavior/structural tests + conditional browser evidence
Tier 3: focused + relevant regression/integration/environment evidence
```

Do not run unrelated full suites solely because HTML/CSS changed.

## Roles

- **Web CTO:** classifies risk, fixes evidence, reviews final exact head, and merges.
- **Web Developer:** implements and corrects branch/CI; does not make final merge decision.
- **Local Validation:** executes exact-head local/environment checks only when required.

## Hard standing rules

Regardless of tier:

- no secret/private-payload exposure;
- no destructive interference with another worker's state;
- Production-destructive data/schema/security-policy changes require owner approval;
- no merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`;
- use canonical alternative evidence for `CI_UNAVAILABLE_INFRA`;
- verify expected head and squash merge;
- never close #1882; use `Refs #1882` only.

## Report fields

```text
risk tier
UI class if applicable
classification reason
exact head
changed files
behavior unchanged
focused checks and counts
CI classification
Local Validation: REQUIRED / NOT_REQUIRED / COMPLETED / PENDING
browser/Production evidence remaining
```

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
