# Autonomous Frontier Implementation Lane

> **Status:** owner-approved operating amendment — 2026-08-17
> **Scope:** advanced/frontier-capability implementation models working in `skerishKang/LoveBud`
> **Relationship:** this is an alternate implementation entry path, not a replacement for Web CTO final review, parallel-writer safety, CI governance, or merge authority.

## 1. Purpose

LoveBud normally uses a CTO-first lifecycle:

```text
user request
→ Web CTO triage / contract / authority allocation
→ implementation owner
→ CI / required evidence
→ Web CTO independent final review
```

Advanced or frontier-capability models may also operate through an owner-approved autonomous implementation lane:

```text
advanced/frontier model
→ fresh repository / Issue / PR inspection
→ identify a useful non-conflicting implementation problem
→ create or select a bounded Issue
→ implement on a feature branch / dedicated worktree
→ focused tests + Draft PR + CI
→ report the exact result
→ Web CTO independently verifies the implementation
```

The absence of a prior Web CTO assignment is **not itself a defect** when this lane applies.

The Web CTO must review the resulting implementation as an independently proposed candidate change, not reject or distrust it merely because the CTO did not initiate the work.

## 2. What “advanced/frontier” means

`ADVANCED_FRONTIER_MODEL` is a capability designation, not a vendor or product-name allowlist.

A model belongs in this lane only when it can reasonably:

- inspect current repository state before writing;
- understand Issue/PR relationships and implementation scope;
- detect existing branch/file/semantic-authority ownership;
- choose a bounded change instead of a broad speculative rewrite;
- add or update focused tests;
- produce additive feature-branch history and a Draft PR;
- report exact remote evidence for independent review.

A weaker executor should continue to use an explicitly assigned contract rather than self-allocate implementation authority.

## 3. Autonomous work allowed before CTO assignment

Within the safety rules below, an advanced/frontier implementation model may autonomously:

- fresh-query `main`, Issues, PRs, active branches, comments, and CI;
- identify a concrete defect, missing product slice, regression, or bounded follow-up;
- select an existing unowned Issue or create a narrowly scoped child Issue;
- create a feature branch and dedicated worktree;
- modify in-scope source, tests, and documentation;
- run focused local checks;
- create additive commits and normal pushes;
- open and maintain a Draft PR;
- inspect and correct CI failures attributable to its own change;
- stop and report when a dependency, collision, or external gate prevents safe continuation.

The model does **not** need a retroactive CTO instruction merely to make those actions legitimate.

## 4. Mandatory pre-write collision check

Autonomy does not override multi-model safety.

Before source mutation, the model must verify:

```text
current remote main
open PR ownership
active branch ownership
changed-file overlap
semantic-authority overlap
```

The existing coordination rule remains authoritative:

```text
ONE WRITER PER BRANCH
ONE WRITER PER FILE
ONE WRITER PER SEMANTIC AUTHORITY
```

If another worker owns the same branch, file, or semantic authority, autonomous implementation must stop, narrow to a genuinely independent surface, or wait for explicit ownership transfer.

A model may not use “autonomous frontier lane” as justification for creating a competing implementation.

## 5. High-risk actions remain separately gated

Autonomous implementation authority does **not** grant authority for irreversible or external-state operations.

Unless separately owner/task-authorized, the model must not perform:

- Ready transition;
- merge or auto-merge;
- protected or parent Issue closure;
- Production deployment or routing cutover;
- Production/real-user DB DDL or DML;
- Firebase, Neon, Cloudflare, Modal, OAuth, provider, billing, or secret/config mutation;
- credential/secret creation, rotation, export, or disclosure;
- real-user data mutation for testing;
- destructive git cleanup/reset, published-history rewrite, rebase, amend, or force push.

Draft PR creation and ordinary additive feature-branch implementation remain allowed.

## 6. Required implementation report

An autonomous worker should report enough evidence for the Web CTO to review without relying on the worker's private reasoning.

Minimum useful report:

```text
problem / Issue selected
why the work is bounded and useful
starting current main SHA
branch / worktree
final head SHA
changed files
behavior implemented
focused tests and counts
regression checks
exact-head CI state
Draft PR
known limitations / external gates
Production/provider/DB mutation = NONE or exact separately-authorized action
Ready = NO unless separately delegated
Merge = NO unless separately delegated
```

If the worker created its own Issue, the report must distinguish:

```text
ISSUE_CREATED_BY_WORKER
!=
OWNER/CTO_FINAL_PRODUCT_ACCEPTANCE
```

## 7. Web CTO review behavior

When an autonomous advanced/frontier implementation arrives, the Web CTO should begin from this question:

> **Is the implementation technically and architecturally sound?**

The CTO should **not** begin from:

> **Did I personally assign this first?**

The CTO independently fresh-verifies:

- current `main`;
- Issue purpose and whether the problem is worth solving;
- active competing ownership;
- exact PR head/base and cumulative changed files;
- implementation scope and architecture authority reuse;
- focused-test quality and whether behavior is actually executed;
- exact-head CI;
- security, privacy, auth, schema, runtime, and user-facing regression risk;
- whether external or irreversible actions stayed behind their gates.

The CTO may then classify the result as:

```text
PASS
PASS_WITH_CORRECTION
SOURCE_CORRECTION_REQUIRED
HOLD
REJECT
```

Definitions:

- `PASS` — implementation can be preserved as submitted, subject to normal integration authority.
- `PASS_WITH_CORRECTION` — implementation is sound; metadata, report wording, or a narrow non-source correction is needed.
- `SOURCE_CORRECTION_REQUIRED` — direction is valid but source/test behavior must change before acceptance.
- `HOLD` — technical work may be preserved, but dependency/product sequencing prevents current integration.
- `REJECT` — implementation establishes the wrong authority, duplicates another implementation, violates safety boundaries, or is otherwise unsuitable.

A missing prior CTO assignment is not one of these rejection reasons by itself.

## 8. Independent-review safeguard remains mandatory

Autonomous implementation does not collapse implementation and final approval into one context.

```text
worker self-selected implementation
→ worker implementation evidence
→ separate Web CTO independent verification
→ task/owner-authorized integration
```

The implementation worker's own claim of completion is evidence input, not final CTO acceptance.

Likewise, Web CTO approval does not automatically create merge authority when Ready/merge remains owner-gated.

## 9. When CTO-first allocation is still preferred

Use the normal CTO-first path when:

- product intent is ambiguous;
- multiple reasonable architectures compete;
- a current writer already owns the semantic authority;
- the work crosses Auth, schema, identity, entitlement, deployment, billing, or Production boundaries;
- a migration/cutover sequence must be coordinated across several active PRs;
- the likely implementation is broad enough that scope should be fixed before writing.

The autonomous lane exists to remove unnecessary coordination latency for capable models, not to remove architecture governance.

## 10. Operating summary

```text
DEFAULT PATH
CTO assigns
→ worker implements
→ CTO verifies

AUTONOMOUS FRONTIER PATH
capable worker discovers + implements safely
→ worker reports exact evidence
→ CTO verifies after implementation

BOTH PATHS
→ same collision rules
→ same CI/evidence standards
→ same independent final review
→ same external/Production/merge gates
```

Owner direction, 2026-08-17:

> Advanced/frontier models may sometimes solve an Issue first and then bring the implementation to the Web CTO for verification. The Web CTO should treat that as a valid implementation workflow and review the result on its merits rather than treating the lack of a prior CTO instruction as an error.

Refs #1882 — Keep OPEN.
