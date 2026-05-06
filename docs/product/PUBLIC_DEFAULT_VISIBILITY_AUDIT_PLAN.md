# Public-default visibility audit plan

**Status:** Planning and audit guide  
**Owner:** CTO / Product / Ops  
**Related issue:** #674

This document defines the safe read-only audit path for aligning LoveBud tree visibility with the current public-by-default product policy until a paid or entitled private-storage model is intentionally available.

The goal is not to mutate production data from this document. The goal is to make the next implementation or data-disposition step explicit, count-only, and safe.

---

## 1. Current policy

LoveBud's current v0.1 policy is:

- new default/free trees should be public;
- private trees are a future paid or entitled feature;
- private visibility should not be created or saved as the normal free/default state;
- public visibility and Browse/Search eligibility are separate concepts;
- anonymous public exposure must still respect parent tree visibility and public-read guards;
- no production data mutation may occur without explicit CTO approval.

This policy is consistent with the existing product docs that describe public-first visibility, Plus private storage, memory visibility inheritance, anonymous public exposure, and Browse/Search eligibility as separate decisions.

---

## 2. Existing related coverage

Related historical coverage exists, but it does not replace the read-only audit required by #674.

Existing coverage includes:

- policy direction for public-first plus private storage;
- Modal public-first create behavior and private entitlement guard documentation;
- parent-tree visibility guard documentation for anonymous public memory reads;
- product-index highlights for public visibility versus Browse/Search eligibility.

Remaining #674 gap:

- current safe counts of public/private/default rows are not recorded here;
- current create-tree client and backend defaults need a fresh current-main audit;
- any currently exposed UI path that can save private visibility before entitlement needs current confirmation;
- any production backfill must be planned separately and explicitly approved.

---

## 3. Read-only audit scope

The first audit pass should be read-only.

Inspect and report only safe aggregate/status values for:

1. tree visibility schema and accepted values;
2. current default create-tree behavior when visibility is omitted;
3. current frontend create-tree payload behavior;
4. current backend/Modal create-tree default behavior;
5. current private visibility entitlement guard behavior;
6. whether the UI exposes a private toggle or save path before entitlement exists;
7. whether Browse/Search public listing still separates public visibility from eligibility;
8. count-only visibility distribution.

Reports must not include tree IDs, owner IDs, memory IDs, copied tree IDs, raw DB rows, raw payloads, tokens, sessions, cookies, passwords, private keys, or DB URLs.

---

## 4. Safe count-only report template

Use safe labels and aggregate counts only.

```text
[Public-default visibility audit]
Repository SHA:
Runtime target:
Database target category: PRODUCTION / STAGING / LOCAL / NOT_QUERIED
Schema visibility field: PRESENT / MISSING / UNKNOWN
Accepted visibility values: PUBLIC_PRIVATE / OTHER / UNKNOWN
Create-tree frontend default: PUBLIC / PRIVATE / OMITTED / UNKNOWN
Create-tree backend omitted default: PUBLIC / PRIVATE / UNKNOWN
Private entitlement guard: PRESENT / MISSING / UNKNOWN
Pre-entitlement private UI path exposed: YES / NO / UNKNOWN
Browse/Search eligibility separate from visibility: YES / NO / UNKNOWN
Public tree count: <number or NOT_QUERIED>
Private tree count: <number or NOT_QUERIED>
Unknown/null visibility count: <number or NOT_QUERIED>
Production mutation performed: NO
Restricted values exposed: NO
Recommended next step: NO_ACTION / BACKFILL_PLAN / DEFAULT_FIX_PR / UI_GUARD_PR / ADDITIONAL_AUDIT
```

If counts are unavailable because the executor lacks safe database access, report `NOT_QUERIED` rather than guessing.

---

## 5. Backfill planning gate

If the audit finds non-entitled private/default rows that should become public, prepare a separate backfill plan before any mutation.

A backfill plan must include:

- target environment;
- exact inclusion criteria described without exposing row identifiers;
- exclusion criteria for deleted, archived, paid, entitled, or intentionally private rows;
- before-count and after-count verification plan;
- rollback or restore approach;
- whether `updated_at` is preserved or intentionally changed;
- explicit CTO approval line for production mutation.

No production mutation should be performed from a docs-only PR.

---

## 6. Default creation enforcement gate

If new default/free trees can still be created as private, create a narrow implementation PR after the read-only audit.

The implementation PR should be scoped to the smallest responsible layer:

- frontend payload default if the client sends private by default;
- backend/Modal omitted visibility default if the server stores private when omitted;
- backend entitlement rejection if private is accepted without entitlement;
- UI toggle hide/disable if private selection is exposed before entitlement.

Do not combine this with My Trees visual redesign, Browse visual work, Editor work, paid entitlement implementation, billing, or data backfill.

---

## 7. Verification requirements for follow-up PRs

Read-only audit PRs:

- changed files limited to docs/product or docs/engineering index files;
- no runtime code changes;
- no database mutation;
- no restricted values;
- issue body and PR body use `Refs #674` only.

Implementation PRs:

- `git diff --check`;
- relevant JS/Python syntax checks for changed runtime files;
- `npm test` and `npm run verify` when applicable;
- fixed slot or Cloudflare runtime verification for UI/Auth/API behavior;
- safe status labels only.

Backfill or production mutation:

- explicit CTO approval required before execution;
- count-only before/after report;
- no row identifiers in reports;
- rollback or restore path recorded.

---

## 8. Current disposition

This document covers the planning and safe audit shape for #674. It does not claim that existing data is already aligned. It does not perform a backfill. It does not change runtime creation defaults. It does not implement paid/private entitlement.

#674 should remain open until the read-only audit is performed and any required backfill/default-enforcement follow-up is either completed or explicitly deferred.
