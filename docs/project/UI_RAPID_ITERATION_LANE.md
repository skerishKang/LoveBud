# UI Rapid Iteration Lane

> **Status:** owner-approved operating policy — Issue #3664
> **Parent operating model:** `WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
> **Hard-governance authority:** `../ops/MVP_AGENT_GOVERNANCE.md`
> **Parallel-work authority:** `../ops/PARALLEL_WORKTREE_AGENT_POLICY.md`

## 1. Purpose

LoveBud must not apply backend-, database-, authentication-, or security-grade process weight to every copy, spacing, color, and other reversible UI change.

The UI Rapid Iteration Lane exists to:

- shorten low-risk visual feedback loops;
- allow multiple Production visual iterations in one work session;
- keep Local Validation for work that actually needs a local checkout, browser profile, authenticated session, database, provider tool, operating-system integration, or broad regression evidence;
- preserve independent Web CTO review, exact-head integration safety, and Production visual acceptance;
- preserve one-writer-per-semantic-authority coordination when multiple agents work in parallel.

This policy changes process weight, not engineering quality or integration authority. Verification remains proportional to the behavior that can be affected.

## 2. Classification is mandatory

Every user-facing UI change must be classified before implementation.

```text
U0 — Copy-only
U1 — Visual-only
U2 — Structural UI
U3 — Runtime-sensitive UI
```

Classification is based on actual affected behavior, not the file extension alone.

A CSS edit can be U2 if it changes responsive structure or visibility semantics. An HTML edit can be U0 if it only changes static copy. Any uncertainty should escalate one level rather than block the work.

In an explicitly declared multi-model lane, also classify branch/path/semantic-authority overlap as `GREEN`, `YELLOW`, or `RED` before writing.

## 3. U0 — Copy-only

### Typical scope

- typo correction;
- button or navigation label;
- helper text;
- empty/error/loading message copy;
- Korean/English translation correction;
- non-behavioral title, description, placeholder, or aria text;
- punctuation, spacing, capitalization, or terminology alignment.

### U0 boundary

U0 must not change:

- DOM structure;
- event behavior;
- validation logic;
- routing;
- auth or permission behavior;
- API/data/cache/storage behavior;
- visibility logic;
- security or privacy semantics.

### Default flow

```text
Web CTO exact-copy contract
→ separate Web Developer direct branch edit
→ focused syntax/static/diff verification
→ Web CTO exact-head review
→ user/task integration decision
→ authorized expected-head merge when applicable
→ Production copy/visual confirmation
```

### Default evidence

- exact changed files;
- exact before/after copy;
- syntax or parser check when relevant;
- focused contract only when one exists for the affected copy;
- `git diff --check` or equivalent remote diff review;
- CI classification;
- Production confirmation after an authorized merge.

### Local Validation

Skipped by default.

Local Validation is added only if the copy is generated dynamically, depends on localization runtime behavior, is auth/data-state dependent, or cannot be verified from the branch and Production flow.

## 4. U1 — Visual-only

### Typical scope

- page-scoped color;
- spacing, gap, padding, or margin;
- font size, weight, line height, or letter spacing;
- border, radius, shadow, opacity, or background;
- icon size or alignment;
- simple page-scoped visual token adjustment;
- non-structural hover/focus appearance;
- shimmer color or animation duration without lifecycle changes.

### U1 boundary

U1 must not change:

- DOM structure or reading order;
- responsive breakpoint structure;
- show/hide or accessibility-tree semantics;
- JavaScript behavior;
- event or focus flow;
- auth/API/data/cache/storage behavior;
- broad shared/global CSS where unrelated pages may change materially.

### Default flow

```text
Web CTO visual delta contract
→ separate Web Developer direct branch edit
→ focused CSS/static/diff verification
→ Web CTO exact-head review
→ user/task integration decision
→ authorized expected-head merge when applicable
→ user/CTO Production visual confirmation
→ optional immediate follow-up micro PR
```

### Default evidence

- affected selector/token and before/after values;
- changed-file and scope review;
- focused CSS/static contract when available;
- syntax/build check only when the changed source requires it;
- CI classification;
- Production visual confirmation after integration.

### Local Validation and screenshots

Skipped by default.

Pre-merge screenshots are optional. They may be requested when the change is difficult to infer from the diff, affects several breakpoints, or has a high chance of clipping/overflow.

Production visual confirmation is the normal final visual check under the merge-first evidence workflow when a merge is separately authorized.

## 5. U2 — Structural UI

### Typical scope

- DOM structure or component composition;
- card composition or result layout;
- skeleton/loading shell structure;
- responsive layout structure;
- multi-column, stacking, wrapping, or breakpoint behavior;
- visibility, focus order, or accessibility-tree semantics;
- shared UI component used by several pages;
- coordinated Browse/My Trees/Editor layout work;
- new empty/error/loading state composition.

### Default flow

```text
Web CTO design/state contract or UI Lab prototype
→ separate Web Developer implementation
→ focused unit/contract/static tests
→ Local Validation only when the affected behavior needs local/browser evidence
→ Web CTO exact-head review
→ user/task integration decision
→ authorized expected-head merge when applicable
→ Production visual acceptance
```

### Required evidence

- target desktop/mobile structure;
- affected states and breakpoint rules;
- focused executable tests for DOM/state contracts where practical;
- layout/overflow/browser evidence when the changed structure cannot be proven statically;
- Production visual acceptance after integration.

### UI Lab

Use a standalone UI Lab or prototype when visual iteration would otherwise require repeated authentication, live data, slow API calls, or navigation into a complex page.

The UI Lab should expose relevant states directly, for example:

```text
loading
cached-refreshing
loaded
empty
error
mobile
reduced motion
```

After visual approval, the Web Developer maps the approved structure into Production code.

## 6. U3 — Runtime-sensitive UI

### Typical scope

- JavaScript interaction or lifecycle;
- auth/session/permission UI;
- API or database-backed loading;
- cache, storage, persistence, or optimistic state;
- routing or navigation behavior;
- form submission, save, edit, cancel, or recovery;
- modal state or browser history;
- privacy/security boundary;
- runtime accessibility behavior;
- new dependency or broad shared runtime change.

### Default flow

```text
Web CTO contract and semantic-authority allocation
→ separate Web Developer implementation and tests
→ GitHub CI
→ Local Validation exact-head runtime/browser/auth/environment evidence when trigger-qualified
→ Web CTO final review
→ user/task integration decision
→ authorized expected-head merge when applicable
→ Production runtime verification
```

U3 uses the full separated execution model and semantic-authority collision checks.

## 7. Escalation triggers

A U0/U1 change must be escalated to U2 or U3 when any of the following appears:

- JavaScript or event behavior changes;
- DOM/read-order/focus-order changes;
- `hidden`, `display`, `visibility`, `aria-*`, inertness, or tab-order semantics change;
- auth, API, database, cache, localStorage, sessionStorage, or persistence changes;
- responsive structure changes rather than a simple visual value;
- broad `css/global.css` or shared-token impact across unrelated pages;
- a new dependency, build configuration, workflow, or bundling change;
- privacy, security, ownership, publication, or entitlement semantics;
- the visual change cannot be safely reversed with a small follow-up PR.

Escalation may also move an implementation from `GREEN` to `YELLOW/RED` when the change enters another agent's active semantic authority.

## 8. Issue policy

### U0/U1

A new Issue is not required for every visual micro-change.

Allowed linkage:

- reference the active parent/product Issue;
- reference the current UI objective Issue;
- use a PR-only micro correction when the user request and scope are fully recorded in the PR.

Create a separate Issue when the change introduces a distinct product goal, policy decision, cross-page contract, security/privacy concern, or substantial follow-up work.

### U2/U3

Use an Issue or an explicit existing parent/child contract because the change carries structural or runtime acceptance criteria.

## 9. PR policy

### U0/U1 micro PR

A micro PR should normally be:

- small and reversible;
- limited to affected files;
- free of unrelated refactoring;
- explicit about `UI class: U0` or `UI class: U1`;
- explicit about Local Validation being `NOT_REQUIRED` or the reason it was requested;
- explicit about the focused checks actually run;
- explicit about active semantic authority/parallel classification when a multi-model lane is active.

Outside an explicit lane that requires Draft, Draft state remains process-lightweight and may be optional. Inside an explicitly declared multi-model lane, follow that lane's Draft/integration gate. Ready status never replaces independent Web CTO approval or task-specific integration authority.

### U2/U3 PR

Use the normal implementation, evidence, writer-ownership, and review fields from the parent operating model.

## 10. Test matrix

| Class | Default pre-merge checks | Local Validation | Browser evidence | Full regression |
|---|---|---|---|---|
| U0 | exact diff, syntax/static check, focused copy contract if present, CI classification | skipped | optional pre-merge; Production confirmation | not required solely for copy |
| U1 | exact diff, CSS/static check, focused visual contract if present, CI classification | skipped | optional pre-merge; Production confirmation | not required solely for page-scoped visual values |
| U2 | focused structural/contract tests, affected build/static checks, CI | conditional | conditional pre-merge; Production acceptance | only when shared/broad risk warrants it |
| U3 | focused + relevant regression/build/runtime checks, CI | trigger-qualified | required when affected runtime acceptance needs browser/environment evidence | risk-based relevant regression required |

The table does not weaken canonical CI hard rules. If a relevant CI step executes and fails, classify it according to `MVP_AGENT_GOVERNANCE.md`.

Unrelated full-suite commands must not be added merely because a UI file changed. The Web CTO contract selects tests based on affected behavior and shared-surface risk.

## 11. Screenshot policy

Screenshots are evidence, not ceremony.

- U0: normally unnecessary before merge.
- U1: optional before merge; use when visual inference from the diff is weak.
- U2: usually useful for layout-sensitive states and viewports.
- U3: useful where browser/runtime state is part of the acceptance criteria.

Final subjective visual judgment belongs to the Web CTO/user after inspecting evidence or Production.

## 12. Rapid Production correction loop

For U0/U1, an unsuccessful visual result should lead to a new small follow-up PR rather than a large investigation cycle.

```text
Production observation
→ exact micro correction on a new branch
→ focused checks
→ independent exact-head review
→ user/task integration decision
→ authorized expected-head merge when applicable
→ Production re-check
```

Do not force-push or reset `main`. If a merged change is harmful and cannot be corrected safely with a small follow-up, use a dedicated revert PR.

## 13. Parallel UI work

Parallel UI work is allowed only when branch, file, and semantic authority are independent.

Recommended `GREEN` split:

```text
Web Developer A: Browse page-scoped visual authority
Web Developer B: My Trees page-scoped visual authority
Web Developer C: Editor page-scoped visual authority
```

Before writing, use:

```text
GREEN  = independent file + semantic authority → parallel implementation
YELLOW = different files but shared semantic authority → review/sequencing only
RED    = same file/core authority → one active writer
```

Shared tokens, global CSS, common components, shared JavaScript, accessibility/visibility semantics, auth/API/runtime boundaries, or any other cross-page semantic authority must have one active writer or a serialized dependency order.

## 14. Required reporting fields

Every UI implementation report must include:

```text
UI class: U0 / U1 / U2 / U3
classification reason
active semantic authority / writer
parallel class: GREEN / YELLOW / RED
changed files
behavior explicitly unchanged
focused checks
CI classification
Local Validation: REQUIRED / NOT_REQUIRED / COMPLETED / PENDING
pre-merge browser evidence: USED / NOT_USED / NOT_REQUIRED
integration authority: AUTHORIZED / NOT_AUTHORIZED / PENDING
Production verification required: YES / NO
exact head SHA
```

## 15. Governance boundary

This lane does not add or remove hard blockers. It allocates verification effort according to change risk while inheriting canonical writer and integration authority.

The following remain authoritative:

- no secret or private-payload exposure;
- no destructive interference with another worker's state;
- production-destructive changes require approval;
- no merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`;
- documented alternative evidence for `CI_UNAVAILABLE_INFRA`;
- one writer per branch/file/semantic authority in an active multi-model lane;
- implementation workers do not Ready-transition or merge their own active PR unless task-specific owner authorization delegates that integration authority;
- any authorized merge requires independent review and exact-head verification;
- never close #1882 and use `Refs #1882` only.

Refs #3994.
Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
