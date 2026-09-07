# LoveBud Agent Guidance

This file is the repository-wide entrypoint for LoveBud work. Detailed rules live in focused documents. Always verify current remote `main` and the exact target head before acting.

## 1. Guidance hierarchy

1. `docs/ops/MVP_AGENT_GOVERNANCE.md` — hard blockers, CI classification, Production correction sequencing, browser permission, expected-head merge, owner-approved role/UI policy.
2. `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md` — owner-approved reversible Production correction / rollback-first procedure.
3. `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` — separated execution roles.
4. `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md` — owner-approved advanced/frontier autonomous implementation path and CTO post-implementation review behavior.
5. `docs/project/UI_RAPID_ITERATION_LANE.md` — U0/U1/U2/U3 UI process.
6. `docs/project/ROLE_SESSION_TEMPLATES.md` — copy-ready role prompts.
7. `docs/architecture/SHARED_LOVE_PLATFORM_AUTHORITY.md` — cross-repository LoveBud/LoveTree Product auth/backend/data authority and mandatory provider-mutation preflight.
8. Product/design/engineering/ops source-of-truth documents relevant to the task.

When documents conflict, the higher item wins. Historical runbooks and task-specific documents do not create new repo-wide blockers without owner approval. For LoveBud/LoveTree shared Auth/DB/backend/provider work, the latest explicit Product Owner decision plus `LoveBud#4004` / `LoveTree#152` remains controlling architecture authority even when a lower-level child issue describes a test or prototype resource.

## 2. Hard standing rules

- Never expose or commit secrets, credentials, cookies, sessions, tokens, private keys, database URLs, authorization headers, or private payloads.
- Never destructively overwrite another worker's branch, worktree, stash, staged, untracked, or uncommitted state.
- Production-destructive data/schema/security-policy changes require owner approval.
- Do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`.
- `CI_UNAVAILABLE_INFRA` is not a code failure; use the documented alternative-evidence path.
- Verify exact expected head and squash merge.
- A reversible Production correction must capture a rollback point and define immediate post-change verification before mutation.
- CI merge blockers are not automatically blockers for a separately authorized reversible Production correction.
- Task-specific explicit Production approval remains required when the governing Issue/runbook demands it.
- Never close #1882; use `Refs #1882` only.

### Shared Love platform hard gate

For any work involving Auth, Firebase, Neon, Cloudflare Worker, DB/schema/data, shared API, provider config, Preview/Production routing, or mutable E2E infrastructure, read first:

```text
LoveBud#4004
LoveTree#152
LoveBud#4005 when DB/schema/data is involved
LoveBud#4006 when auth/identity is involved
```

Current Product architecture during migration is:

```text
LoveBud + LoveTree
= ONE Product authentication authority
= ONE shared backend/API authority
= ONE canonical writable Tree/Memory/social data authority

current Product auth = shared Firebase Auth
target auth = staged Neon Auth migration through stable account mapping
LoveTree separate DB = TRANSITIONAL_BRIDGE_NONCANONICAL
```

Before creating, configuring, binding, deploying, deleting, or reusing any provider/database/auth resource, classify it exactly once:

```text
CANONICAL_PRODUCT_AUTHORITY
TRANSITIONAL_BRIDGE_NONCANONICAL
TEST_ISOLATION_ONLY
PROTOTYPE_ONLY
HISTORICAL_EVIDENCE_ONLY
UNKNOWN_STOP
```

`UNKNOWN_STOP` means zero mutation.

Explicit invariants:

```text
DEDICATED_E2E_FIREBASE != NEW_PRODUCT_AUTHORITY
ISOLATED_E2E_WORKER != NEW_SHARED_BACKEND
DISPOSABLE_NEON_BRANCH != NEW_CANONICAL_DB
```

The worker must report before mutation:

```text
PARENT_4004_READ = YES
LOVETREE_152_READ = YES
DATA_4005_READ_IF_RELEVANT = YES/NA
AUTH_4006_READ_IF_RELEVANT = YES/NA
CURRENT_REMOTE_FRESH = YES
CURRENT_PROVIDER_IDENTITY_FRESH = YES/NA
RESOURCE_CLASS = <classification>
SECOND_CANONICAL_WRITER_CREATED = NO
SECOND_PRODUCT_AUTHORITY_CREATED = NO
TEST_RESOURCE_PROMOTED_TO_PRODUCT = NO
ARCHITECTURE_CONSISTENCY_GATE = PASS/STOP
```

`STOP` means zero provider/DB mutation. Historical row counts, branch IDs, SHAs, deployment identities and old issue comments are evidence only; fresh-query the exact current target before acting.

## 3. Default execution roles

```text
Web CTO
Web Developer
Local Validation when required
```

Default lifecycle for ordinary source integration:

```text
user request
→ Web CTO contract
→ separate Web Developer implementation
→ Local Validation only when required
→ Web CTO independent final review
→ user decision / expected-head squash merge
```

Owner-approved autonomous frontier lifecycle:

```text
advanced/frontier implementation model
→ fresh remote / Issue / PR / ownership inspection
→ select or create a bounded non-conflicting Issue
→ feature-branch implementation + focused tests + Draft PR
→ report exact evidence
→ Web CTO independent post-implementation review
→ user/task-authorized integration
```

For the autonomous frontier lane, **lack of a prior Web CTO assignment is not itself an implementation defect**. The Web CTO reviews the submitted implementation on technical, architectural, collision, safety, test, and CI evidence. See `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`.

### Web CTO

Owns remote verification, product/architecture/design contract, scope, risk classification, tests/evidence, final review, READY/NOT_READY, merge judgment, and Production-first eligibility/rollback judgment when Production authority exists.

When an advanced/frontier worker self-selects and implements a bounded Issue before receiving a CTO instruction, the CTO treats the resulting PR as an independently proposed candidate implementation. The CTO must not reject it merely because the CTO did not initiate it; the CTO fresh-verifies whether the work is valid and classifies it on its merits.

### Web Developer

Works in a separate web context. Owns feature-branch implementation, focused tests, PR maintenance, CI correction, and exact evidence. Does not make final merge/product decisions unless task-specific authority explicitly delegates them.

### Local Validation

Runs exact-head local/environment/browser/auth/database/provider/OS evidence only when required. It is not the default coder or UI designer.

An explicitly designated advanced/frontier local implementation model may instead use the autonomous frontier lane; that is a separate implementation role from ordinary `Local Validation`.

A reversible Production correction does not require Local Validation merely because it is a Production change. Use the dedicated Production-first policy when the action is separately authorized and rollback-ready.

## 4. UI Rapid Iteration Lane

Every UI change is classified:

```text
U0 — copy-only
U1 — visual-only
U2 — structural UI
U3 — runtime-sensitive UI
```

### U0/U1 default

```text
Web CTO exact delta
→ Web Developer direct branch edit
→ focused checks
→ Web CTO exact-head review/merge
→ Production visual confirmation
```

Defaults:

- no Local Validation;
- no fixed slot/preview requirement;
- no pre-merge screenshot matrix;
- no unrelated full suite;
- no new child Issue for every micro correction.

### U2

DOM/layout/loading/responsive/accessibility structure uses focused structural tests and conditional Local/browser evidence. Use a UI Lab/prototype when live data/auth would slow visual iteration.

### U3

JavaScript, auth, API/data, cache/storage, routing, forms, persistence, privacy/security, or runtime accessibility uses the full relevant source-integration path.

Escalate U0/U1 if the actual change affects DOM/focus/visibility semantics, broad shared/global files, dependencies, runtime state, privacy, or security.

When a Production runtime/UI correction is separately authorized, bounded, observable, and reversible, `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md` controls Production sequencing even if source-integration evidence is still incomplete.

## 5. Product and design source of truth

Read when product/UX judgment is needed:

1. `docs/product/PRODUCT_IDENTITY.md`
2. `docs/product/BRAND_EXPERIENCE.md`
3. `docs/design/UI_DESIGN_SYSTEM.md`

LoveBud/LoveTree is a warm fan-memory and appreciation product, not a generic admin dashboard, bookmark manager, cold data tool, or generic community feed.

Preferred product language includes:

- 순간 이어가기;
- 대표 순간;
- 이어진 기억;
- 감정 흐름;
- 첫 순간;
- 현재 트리;
- 현재 순간.

Implementation path names may use `search`; user-facing experience should normally use Browse/둘러보기 language.

## 6. Current runtime

- Production frontend: `https://lovebud.pages.dev/`
- Entry/runtime: Cloudflare Pages and same-origin `/api/*`
- Primary backend/compute: Modal
- Database: Neon where applicable
- Vercel: secondary/transitional
- Netlify: legacy artifact, not active fallback

These bullets describe the current LoveBud runtime surface, not the final cross-repository Product authority. Shared-platform convergence is governed by #4004/#152; a current Modal/Neon/Firebase implementation detail must not be mistaken for permission to create a competing LoveTree or LoveBud authority.

Browser requests should use same-origin `/api/*` when possible.

## 7. Browser and Production verification

Evidence levels:

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
POST_CHANGE_EVIDENCE
ROLLBACK_EVIDENCE
```

- Browser tooling, login, navigation, DevTools, Playwright, screenshots, preview, fixed slot, localhost, and Production are allowed when the task permits them.
- Preview/fixed slot is optional evidence unless explicitly assigned.
- Do not search for preview URLs or deploy fixed slots by habit.
- Merge-first Production verification remains the normal flow for ordinary source integration.
- Production-first / Rollback-first is the normal flow for a separately authorized reversible Production correction.
- Dynamic/auth/API pages cannot be fully proven by a static local server; report limitations.
- Evidence scope follows actual risk rather than a ritual sequence.

Production-first sequence:

```text
fresh Production state
→ smallest reversible change
→ rollback point captured
→ Production apply
→ immediate verification
→ rollback first if materially unhealthy
→ forensics/follow-up after recovery
```

Do not delay an eligible reversible correction solely because local/staging/preview/CI evidence is unfinished.

## 8. CI

Use exactly:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

Red workflow appearance alone is not enough to classify an executed failure. Inspect whether relevant steps ran.

`CI_EXECUTED_FAILURE` and `CI_PENDING_EXECUTION` block source merge. They do not automatically prohibit a separately authorized reversible Production correction with a credible rollback path.

## 9. Branch and parallel safety

- Never edit/push `main` directly.
- Use feature branches and PRs for source/document integration.
- One active writer per remote branch.
- Separate worktrees for simultaneous local work.
- Split parallel work by non-overlapping files/surfaces/responsibilities.
- Re-check remote head before push and expected head before merge.
- Do not force-push or destructively clean/reset/stash-drop without approval.

For U0/U1, small reversible micro branches/PRs are preferred.

Autonomous frontier implementation does not weaken collision rules. A self-directed worker must fresh-check existing PR/file/semantic-authority ownership before writing and must not create a competing implementation for an already-owned authority.

Production-first authority is not permission to create competing source writers or bypass branch ownership.

## 10. Current local execution environment

- **Primary OS:** Windows.
- **Preferred shell:** PowerShell 7 through `pwsh.exe`.
- Use Windows-native tools and paths by default.
- WSL은 현재 task 또는 operator가 명시적으로 승인한 경우에만 사용한다. WSL은 implicit fallback이 아니다.
- 승인된 WSL 작업은 `$HOME/worktrees/<task-name>`의 WSL 내부 ext4에서 수행한다.
- `/mnt/c`, `/mnt/d`, `/mnt/g` 등 `/mnt/*`는 저장·백업·산출물 보관·읽기 전용 비교 용도로만 사용한다.
- 승인된 WSL 작업에서 `/mnt/*` 아래 npm ci/install/test/lint/build/Playwright/dev server/대량 검색을 실행하지 않는다.
- 필수 Windows-native 도구가 없으면 중단하고 보고한다. WSL로 자동 우회하지 않는다.
- Codex, Kilo, Hermes 등 도구 정체성만으로 WSL/bash를 추론하지 않는다.
- 상세 정책은 `docs/ops/WSL_EXT4_WORKSPACE_POLICY.md`를 따른다.

Detailed source: `docs/ops/PATHS_AND_SHELLS.md`.

Do not print secret files or environment values. Report presence/status only.

## 11. Operational input and image handling

- Pasted completion reports, logs, and command results from another executor or model are decision inputs, not automatically trusted completion evidence.
- The Web CTO or current reviewer independently verifies remote SHA, cumulative diff, changed files, CI, comments, and the underlying evidence needed for the actual decision.
- For an advanced/frontier autonomous worker, a completed implementation may legitimately arrive before any CTO instruction. The reviewer should validate the implementation rather than treating the missing prior instruction as a protocol failure.
- Attached images are analysis, comparison, and review material by default.
- Generate or transform images only when the user explicitly requests image generation or transformation; mentioning an image alone is not such a request.

For Production-first work, the required decision evidence is target freshness, Production authority, rollback point, observability, post-change result, and rollback result if used. Do not demand unrelated test evidence as a substitute.

## 12. Test selection

Tests are selected by affected behavior and blast radius.

- U0: exact diff + syntax/static/focused copy check when relevant.
- U1: exact selector/token delta + focused CSS/static check when available.
- U2: focused structural/layout/accessibility tests and conditional browser evidence.
- U3/backend/data/auth/security source integration: full relevant runtime/regression evidence.
- reversible Production correction: immediate Production verification first; follow with relevant regression/source tests unless the task explicitly requires a different order.

Do not require unrelated `lint/build/test/verify` commands solely because an HTML/CSS file changed.

Do not turn unfinished local/staging/preview/CI testing into an automatic blocker for a separately authorized reversible Production correction.

Always distinguish:

- implemented versus already present;
- focused checks versus CI versus browser evidence;
- Production authority versus source merge authority;
- pre-change versus post-change evidence;
- rollback-ready versus irreversible;
- pristine-main versus branch-only failures;
- verified versus unverified;
- Local required versus skipped;
- merge candidate versus merged;
- merge versus Issue closure.

## 13. Session startup

Recommended order:

1. `AGENTS.md`
2. `docs/ops/MVP_AGENT_GOVERNANCE.md`
3. `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md` when Production correction/diagnostic sequencing may be involved
4. `docs/architecture/SHARED_LOVE_PLATFORM_AUTHORITY.md` when Auth/DB/backend/provider/E2E infrastructure may be involved
5. `docs/project/project_index.md`
6. `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
7. `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md` when a worker may self-select/implement before CTO allocation
8. `docs/project/UI_RAPID_ITERATION_LANE.md` for UI work
9. relevant product/design/engineering/ops documents
10. current remote Issue/PR/diff/CI/Production evidence

For shared-platform work, repository docs do not replace fresh connected reads of LoveBud#4004 / LoveTree#152 / #4005 / #4006 as relevant.

## 14. Key detailed documents

- `docs/architecture/SHARED_LOVE_PLATFORM_AUTHORITY.md`
- `docs/project/ROLE_SESSION_TEMPLATES.md`
- `docs/project/BRANCHING_AND_REVIEW.md`
- `docs/project/LOCAL_MODEL_WORKFLOW.md`
- `docs/project/AUTONOMOUS_FRONTIER_IMPLEMENTATION_LANE.md`
- `docs/project/VERIFICATION_AND_EVIDENCE.md`
- `docs/project/AGENT_OPERATION_GUARDRAILS.md`
- `docs/ops/PR_CHECKLIST.md`
- `docs/ops/PRODUCTION_FIRST_ROLLBACK_FIRST_POLICY.md`
- `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`
- `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md`
- `docs/ops/WSL_EXT4_WORKSPACE_POLICY.md`
- `docs/engineering/CODE_ARCHITECTURE.md`
- `docs/engineering/REVIEW_GUARDRAILS.md`

## 15. One-line operating rule

```text
verify current remote + shared-platform authority + current Production target when relevant
→ classify target resource, mutation authority, reversibility, and collision authority
→ if separately authorized reversible Production correction: capture rollback → apply smallest Production change → verify → rollback first on failure
→ otherwise use CTO-first allocation OR the owner-approved autonomous frontier source lane
→ use the smallest relevant implementation/evidence path
→ independently review exact source head
→ squash merge when separately authorized and CI permits
→ confirm affected Production behavior
```

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.