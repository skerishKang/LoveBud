# LoveBud Next-Work Recommendation Loop — Operational & Safety Contract

> Scope: vendor-neutral, approval-only **next-work recommendation** loop.
> This document is a **design artifact** (planning contract), not executable code.
> It does not modify the Phase 1 dry-run queue, its runner, or any config.

## 1. Purpose

The recommendation loop proposes at most one next unit of work from the existing
Phase 1 dry-run queue. Its only output is a structured **PROPOSE** or **NO_CANDIDATE**
decision. It never executes, commits, merges, deploys, or mutates anything.

## 2. Authoritative source of truth

- The **Phase 1 dry-run queue** (`scripts/loop/`, `config/lovebud-loop.yml`) is the
  **single authoritative source** for policy classification, lane assignment, and
  PR/CI status.
- This recommendation loop is a read-only consumer of that queue; it introduces no competing classifier and defines no second policy file and no alternative status model.
- Any classification the recommendation loop needs is taken **from the queue snapshot**,
  never recomputed independently.

## 3. Input boundary (structured metadata only)

Allowed inputs are **structured queue metadata** produced by the Phase 1 queue:

- `queueSnapshotId`
- candidate identifiers (issue/PR number, lane, status) already classified by the queue
- PR CI check summaries (success/failure/pending counts) as emitted by the queue

**Explicitly forbidden as input:**

- raw issue body, PR body, PR/issue comments
- source code, diffs, commit messages
- any user-generated content
- tokens, secrets, cookies, environment values, auth data, connection strings
- raw production data or any PII

If a required field is only available inside a forbidden source, the input is treated
as **missing** and the loop fails closed (see §7).

## 4. Output decision (enum only)

The recommendation decision is restricted to exactly two values:

- **PROPOSE** — at most one current queue candidate is selected.
- **NO_CANDIDATE** — no candidate is selected.

No other decision value is permitted.

### 4.1 At-most-one candidate

`PROPOSE` may reference **exactly one** `selectedCandidateId`. Multiple candidates in a
single decision are not allowed; the loop must pick the highest-priority eligible
candidate or emit `NO_CANDIDATE`.

### 4.2 No free text in output

The recommendation JSON contains **no** free-text rationale, **no** prompts, **no**
copies of issue/PR bodies, and **no** provider response text. Explanatory content is
limited to controlled `reasonCodes` enum values (see §5.3).

## 5. Strict JSON output schema

```json
{
  "queueSnapshotId": "string",
  "policyVersion": "string",
  "decision": "PROPOSE | NO_CANDIDATE",
  "selectedCandidateId": "string | null",
  "reasonCodes": ["string"],
  "generatedAt": "string"
}
```

Contract rules:

- `additionalProperties: false` — no unknown keys allowed.
- `decision` ∈ {`PROPOSE`, `NO_CANDIDATE`}.
- `selectedCandidateId` is a non-null string **iff** `decision === "PROPOSE"`; `null`
  otherwise.
- `reasonCodes` is a non-empty array of controlled enum strings.
- `generatedAt` is an ISO-8601 timestamp string.
- `queueSnapshotId` and `policyVersion` MUST be copied verbatim from the queue
  snapshot; the loop must not synthesize its own values.

### 5.1 PROPOSE example

```json
{
  "queueSnapshotId": "queue-2026-07-08-a1b2",
  "policyVersion": "lovebud-loop/0",
  "decision": "PROPOSE",
  "selectedCandidateId": "issue-3290",
  "reasonCodes": ["READY_FOR_PLANNING", "AUTO_ELIGIBLE_LANE"],
  "generatedAt": "2026-07-08T09:15:00Z"
}
```

### 5.2 NO_CANDIDATE example

```json
{
  "queueSnapshotId": "queue-2026-07-08-a1b2",
  "policyVersion": "lovebud-loop/0",
  "decision": "NO_CANDIDATE",
  "selectedCandidateId": null,
  "reasonCodes": ["ALL_BLOCKED_BY_CI"],
  "generatedAt": "2026-07-08T09:15:00Z"
}
```

### 5.3 Controlled reason codes (enum)

`reasonCodes` are drawn from a fixed set, e.g.:
`READY_FOR_PLANNING`, `AUTO_ELIGIBLE_LANE`, `HUMAN_REQUIRED_LANE`,
`BLOCKED_BY_CI`, `BLOCKED_BY_DEPENDENCY`, `SCOPE_CONFLICT`, `NO_AUTO`,
`CI_DATA_MISSING`, `CI_STATE_UNTRUSTED`, `CI_UNKNOWN_STATUS`, `STALE_QUEUE`,
`ALL_BLOCKED_BY_CI`, `POLICY_MISMATCH`. This list is the only sanctioned explanatory
vocabulary; free text is prohibited.

## 6. Local failure report (distinct from recommendation)

When the loop cannot produce a valid recommendation, it emits a **local failure report**.

- A local failure report is **separate** from the recommendation JSON.
- It does **not** carry a `decision` field (and must not be mistaken for a
  `PROPOSE`).
- It records the failure class and enough metadata to audit, but no secrets and no
  queue-mutating instruction.

## 7. Fail-closed rules

In any of the following conditions the loop MUST NOT emit `PROPOSE`. It ends with
`NO_CANDIDATE` or a typed local failure report:

- **stale queue** — snapshot age beyond allowed threshold / unknown `queueSnapshotId`.
- **unknown PR/CI status** — `CI_UNKNOWN_STATUS` or missing PR/CI mapping.
- **pending/red CI** — any `pending`/`failure` check (`BLOCKED_BY_CI`).
- **dependency block** — `BLOCKED_BY_DEPENDENCY`.
- **policy mismatch** — queue classification disagrees with `policyVersion` or an
  unknown lane/status surface.
- **malformed output** — the recommendation JSON fails the strict schema
  (`additionalProperties`, enum, or type violation).
- **timeout** — the loop did not finish within its bounded window.
- **unavailable capability** — a needed queue field or runner capability is absent.
- **provider ambiguity** — more than one eligible candidate ties with no defined
  priority, or a selection cannot be justified from queue metadata alone.

## 8. Human approval gate (no autonomous execution)

A recommendation is **advisory only**. The loop performs **none** of the following:

- create / switch / delete a branch or worktree
- create / amend / rebase / force-push a commit
- open / review / merge / close a pull request
- mutate an issue (label, comment, close, reopen, change base)
- run a deployment, API call, DB operation, or credential use
- change Cloudflare / Modal / Neon / auth / secret / production config

Execution of any kind requires an explicit, out-of-band human action.

## 9. Config-only change cannot enable execution

A change to configuration (including `config/lovebud-loop.yml`) MUST NOT, by itself,
activate any model invocation, code edit, GitHub mutation, deployment, or database
operation. Execution enablement is out of scope for config and for this loop.

## 10. Future provider adapter — prohibited until approved

Any future model/provider adapter (e.g. Ollama, cloud LLM, local model runtime) is
**forbidden** until all seven of the following are explicitly approved in writing:

1. **provider** — which provider/model is used
2. **execution location** — where it runs
3. **data boundary** — what data may cross the boundary
4. **cost** — budget and per-run cost limit
5. **timeout** — max runtime per invocation
6. **observability** — logging/metrics and what is recorded
7. **rollback / disable path** — how it is turned off

Until then, no provider code, endpoint, or adapter is implemented.

## 11. Non-goals (current issue)

The following are explicitly **out of scope** for this issue and this loop:

- Ollama installation / runtime
- local model install or runtime
- cloud model integration
- provider endpoints or model configuration
- any model invocation or execution activation

## 12. Relationship to other work

This contract is a design artifact layered above the Phase 1 dry-run queue. It does not
alter the queue's authority. See Refs #1882.
