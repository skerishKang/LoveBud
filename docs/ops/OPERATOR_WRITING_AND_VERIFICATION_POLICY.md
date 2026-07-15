# Operator Writing and Verification Policy

**Status:** Active draft for operators
> **Status:** OPTIONAL / CURRENTLY UNAVAILABLE AS A REQUIRED GATE
>
> 이 절차는 환경이 실제로 사용 가능하고 CTO가 명시적으로 지정한
> 경우에만 사용합니다. 해당 환경의 부재는 merge blocker가 아닙니다.
> 자세한 내용은 `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`를 참고하세요.

**Owner:** CTO / Ops Lead
**Related issue:** #676

This document defines how LoveBud operators should write issues and PR bodies, how they should classify browser/runtime verification, and how verification may be batched without weakening merge standards.

The goal is to keep execution reports useful for future operators. A checklist can say what to do, but the issue or PR body must also explain why the work exists, what user or operator risk it reduces, and what evidence is required before a runtime-sensitive change can be treated as complete.

---

## 1. Prose-first issue and PR writing

Issues and PR bodies should be prose-first. They should not be only a command list or a terse checklist.

A good issue or PR body explains:

- the product or engineering problem;
- why the problem matters to users, reviewers, or operators;
- the intended direction;
- what is in scope;
- what is explicitly out of scope;
- how verification should happen;
- which guardrails apply.

Lists are still appropriate for changed files, acceptance criteria, safety constraints, and verification checklists. The rule is not anti-structure. The rule is that future operators must be able to understand context without reading the full conversation that created the task.

### 1.1 Minimum issue body shape

Use this shape when creating or rewriting operational issues:

```text
## Purpose

Explain what problem this issue exists to solve and why it matters.

## Current problem

Describe the observed failure, ambiguity, or risk.

## Desired outcome

Describe the intended result without over-prescribing implementation.

## Scope

List likely files, systems, or behavior areas.

## Non-goals

List what must not be changed.

## Verification requirements

State which checks, browser targets, fixed slots, runtime environments, or safe status labels are required.

## Acceptance criteria

Use a checklist or bullets for completion criteria.

## Guardrails

List security, privacy, branch, merge, and prototype/reference/demo/variant restrictions.
```

### 1.2 Minimum PR body shape

A PR body should include:

- `Refs #...` links, not close keywords unless explicitly approved;
- a short purpose summary;
- exact changed files or intended file scope;
- behavior-equivalence intent when the PR is a refactor;
- verification already performed;
- verification not performed;
- runtime/browser verification requirements if still pending;
- guardrails such as no production mutation and no secret exposure.

Do not claim runtime PASS from a static PR body.

---

## 2. Valid browser/runtime verification targets

Runtime-sensitive work needs a deployed environment whose source can be tied to the PR or target commit.

Final runtime PASS requires one of these:

1. a valid Cloudflare PR/branch deployment with deployed SHA confirmed;
2. a CTO-assigned fixed test slot with deployed SHA confirmed;
3. production only after the relevant PR is merged and deployed.

Production is not valid pre-merge proof for a PR. Localhost or a local static server may be used for triage, but it is not final PASS for Auth/API/data-loaded behavior.

### 2.1 Runtime-sensitive surfaces

Use Cloudflare deployment or fixed-slot verification for:

- Login/Auth flows;
- My Trees;
- Browse/Search with API data or selected hub interaction;
- Editor;
- Detail when it loads API-backed content;
- Modal/API-backed behavior;
- DB-backed display or mutation paths;
- user-specific state;
- create/edit/save/delete flows;
- loading, flicker, routing, and runtime-state investigations.

### 2.2 Invalid final verification targets

Do not report final PASS from:

- localhost static server output;
- production as pre-merge PR proof;
- arbitrary `/pull/<number>/` paths on production;
- fixed slots with unknown or mismatched SHA;
- text-only/code-only review for browser-dependent behavior;
- screenshots whose URL or deployed SHA is not identified.

If target provenance is unclear, report `PARTIAL` or `BLOCKED`, not PASS.

---

## 3. Fixed-slot browser verification preflight

Before fixed-slot browser verification, record:

- PR number or task name;
- PR head branch;
- PR head SHA;
- assigned fixed slot;
- slot URL;
- slot branch or deployment source;
- deployed SHA or content marker evidence;
- login requirement;
- test-data requirement;
- desktop and mobile 375px screenshot requirement, when UI judgment is involved.

Auth/API/data-loaded verification must use a login-capable environment when login is part of the flow. If login cannot be completed, report `BLOCKED_AUTH` or `PARTIAL`, not PASS.

---

## 4. QA credential and secret reporting

Reports must never include raw credential, token, cookie, session, private key, database URL, owner id, tree id, memory id, copied tree id, or database row values.

Allowed safe labels:

```text
QA_CREDENTIAL: PRESENT / MISSING
LOGIN: PASS / FAIL / BLOCKED
SESSION_VALUE_EXPOSED: NO
TOKEN_VALUE_EXPOSED: NO
TREE_ID_PRESENT: YES / NO
MEMORY_ID_PRESENT: YES / NO
COPIED_TREE_ID_PRESENT: YES / NO
DATA_MUTATION: NO_MUTATIONS / APPROVED_DISPOSABLE_MUTATION_ONLY
```

Use presence/status labels only. Do not print partial prefixes, suffixes, or last characters of restricted values.

If restricted values are exposed, stop the task and report `SECURITY_INCIDENT_SECRET_EXPOSURE` without repeating the value.

---

## 5. Batch verification policy

Implementation work may proceed in batches before browser/runtime verification, but this is verification scheduling, not a relaxation of merge standards.

Default policy:

- Up to roughly five independent implementation PRs may be accumulated as draft PRs before running a fixed-slot/browser verification batch.
- Each PR still needs per-PR scope review, changed-file review, PR hygiene, and secret-safety review.
- Static checks should still be run when available.
- Runtime-sensitive PRs must remain draft or otherwise blocked from merge-ready judgment until required verification exists.
- Ready and merge decisions require the same evidence as before.

### 5.1 When not to batch

Do not delay verification when the PR is:

- foundational for the next PR;
- high-risk Auth/API/DB/Modal behavior;
- a workflow/deployment change whose correctness affects other verification;
- touching overlapping files with another in-flight PR;
- likely to create a conflict if merged late;
- needed to unblock a current browser/runtime investigation.

In these cases, verify immediately or stop and sequence the work.

### 5.2 Batch report format

When a batch is ready, report:

```text
[Batch Verification Plan]
- Batch size:
- PRs included:
- Shared runtime surfaces:
- Overlapping files: YES/NO
- Assigned slot(s):
- Required logins:
- Required test data:
- Desktop screenshots required: YES/NO
- Mobile 375px screenshots required: YES/NO
- Network/API checks:
- Console checks:
- Final status per PR: PASS / PARTIAL / BLOCKED / FAIL
```

Batch verification should still produce per-PR conclusions. A batch PASS must not hide a failure in one PR.

---

## 6. PASS / PARTIAL / BLOCKED / NOT_VERIFIED language

Use these states precisely:

- `PASS`: required observations completed and no blocking regression found.
- `PARTIAL`: some material observations were completed, but one or more required checks are missing.
- `BLOCKED`: verification cannot proceed because of auth, deployment, secret, data, infra, or runtime blockers.
- `FAIL`: observed behavior does not meet expected behavior.
- `NOT_VERIFIED`: no meaningful verification was performed for that requirement.

Do not convert `PARTIAL`, `BLOCKED`, or `NOT_VERIFIED` into PASS for merge convenience.

---

## 7. Safe PR status examples

### Draft implementation awaiting batch verification

```text
Status: DRAFT_IMPLEMENTED / AWAITING_BATCH_RUNTIME_VERIFICATION
Static checks: PASS
Browser verification: NOT_STARTED
Merge candidate: NO
```

### Runtime-sensitive PR blocked by test data

```text
Status: BROWSER_RUNTIME_BLOCKED
Reason: BLOCKED_BY_NO_EDITOR_TEST_DATA
Merge candidate: NO
```

### Workflow that can only run after merge

```text
Status: STRUCTURE_VERIFIED / POST_MERGE_RUNTIME_REQUIRED
Reason: workflow_dispatch is only available after the workflow exists on the default branch
```

---

## 8. Relationship to existing ops docs

This policy complements, but does not replace:

- `TEST_PREVIEW_SLOTS.md` for fixed test slot mechanics;
- `BROWSER_VERIFICATION_URL_POLICY.md` for URL provenance;
- `LOCAL_BROWSER_VERIFICATION_STARTUP.md` for browser startup preflight;
- `GITHUB_AUTH_TOKEN_USAGE.md` for GitHub CLI and token-safe operation;
- `AGENT_SECURITY.md` for secret handling.

When this document and a more specific runbook conflict, use the stricter rule or escalate to CTO before proceeding.
