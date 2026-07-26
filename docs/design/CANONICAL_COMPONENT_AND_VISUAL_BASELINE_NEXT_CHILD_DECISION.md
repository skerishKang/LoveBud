# Canonical Component and Visual-Baseline Next-Child Decision

Parent #3672  
Current child #3674

## Decision

**Selected exactly one candidate: `2. canonical component/variant inventory contract`.**

The other candidates are not authorized by this decision:

1. canonical token disposition registry — later, after component consumers and variant boundaries are explicit;
3. bounded Browse/My Trees shared-component convergence — later, after the contract identifies which similarities are shared behavior and which are owner/public variants;
4. critical-page structural visual-baseline harness — later, after canonical component targets and state names are stable;
5. product/visual acceptance status recording — later, after rendered evidence exists.

## Exact goal

Create one source-only decision contract that inventories the exact current component boundaries and named variants for:

- page hero;
- primary/secondary button;
- search input and filter chip;
- card shell;
- result header;
- right-side hub;
- loading/empty/error states;
- media control;
- modal/dialog;
- focus treatment.

For every entry, the contract must identify:

- exact current source owner;
- consumer pages;
- allowed variant names and semantic differences;
- accessibility and responsive obligations;
- authority/security constraints;
- compatibility identifiers that cannot yet be removed;
- candidate disposition without declaring deletion or migration.

The contract must distinguish visual variants from authority variants, especially Browse public versus My Trees owner behavior and Editor view/read-only/edit behavior.

## Generic Tier

`Generic Tier 2`

Rationale: the child governs shared component boundaries and responsive/accessibility semantics across multiple pages. It does not change runtime behavior.

## UI class

`U2 — Structural UI, source-only decision contract`

- No rendered change.
- Local Validation: `NOT_REQUIRED` for the decision document itself.
- Browser/screenshot: `NOT_USED` and `NOT_AUTHORIZED` for this child.
- Any later implementation child must receive its own U-class and evidence contract.

## Allowed files

Exactly one new file:

```text
docs/design/CANONICAL_COMPONENT_VARIANT_INVENTORY_CONTRACT.md
```

Read-only evidence may be gathered from the same source paths authorized by #3674.

No other file is allowed to change.

## Prohibited files and actions

Prohibited:

- all `index.html` and `pages/**` changes;
- all `css/**` changes;
- all `js/**` changes;
- all template changes;
- all asset changes;
- all test additions or modifications;
- `tests/test-layer-classification.json` changes;
- package, lockfile or workflow changes;
- screenshot or baseline-image generation;
- browser, Preview or Production operation;
- Auth/API/DB/cache/storage/provider changes;
- selector, token, ID, class, route or file renames;
- UI framework introduction;
- broad global CSS rewrite;
- edits to #3669 or #3671 branches/files;
- Ready-for-review conversion, merge, or Issue closure.

## Focused evidence

Required source evidence:

1. exact base SHA and no-drift check;
2. current runtime token imports and component source owners;
3. Home, Browse, My Trees, Editor view/edit and Settings entrypoint inventories;
4. shared card, calm shell, preview hub and appreciation-detail boundaries;
5. direct reading of representative contracts before classifying constraints;
6. explicit owner/public and view/edit/read-only variant table;
7. exact compatibility identifiers whose removal is not authorized;
8. explicit list of unresolved components or variants.

Verification for the document-only PR:

```text
git diff --check
git diff --name-only origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short
```

Expected cumulative diff: exactly the one new decision-contract document.

## Local/browser routing

- Local source/test execution: `NOT_REQUIRED` because no runtime or test source changes are allowed.
- Browser routing: `NOT_REQUIRED` and `NOT_USED`.
- Screenshot routing: `NOT_REQUIRED` and `NOT_USED`.
- Production routing: prohibited.
- Web CTO review: required for the classification and boundary decision.

If the document makes a claim that cannot be supported statically, it must be marked `UNRESOLVED`; it must not trigger browser work within this child.

## Rollback

Rollback is deletion/revert of the single new decision-contract document. No product source, runtime behavior, test, generated asset or deployment state should need restoration.

## Later children not authorized

This decision does not authorize:

- token definition, rename, replacement or migration;
- component extraction, consolidation or deletion;
- Browse/My Trees HTML, CSS or JS convergence;
- Editor template/control convergence;
- focus-ring or accessibility implementation;
- breakpoint, motion or z-index token implementation;
- screenshot capture or visual-baseline storage;
- Playwright/Chromium harness changes;
- product/visual acceptance status recording;
- Production verification or deployment;
- merge or closure of #3672, #3674, #3425, #3458 or #1882.

A later child requires a new exact execution contract from the Web CTO.
