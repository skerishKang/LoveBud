# LoveBud Agent Guidance

This file is the repository-wide entrypoint for LoveBud work. Detailed rules live in focused documents. Always verify current remote `main` and the exact target head before acting.

## 1. Guidance hierarchy

1. `docs/ops/MVP_AGENT_GOVERNANCE.md` — hard blockers, CI classification, browser permission, expected-head merge, owner-approved role/UI policy.
2. `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md` — separated execution roles.
3. `docs/project/UI_RAPID_ITERATION_LANE.md` — U0/U1/U2/U3 UI process.
4. `docs/project/ROLE_SESSION_TEMPLATES.md` — copy-ready role prompts.
5. Product/design/engineering/ops source-of-truth documents relevant to the task.

When documents conflict, the higher item wins. Historical runbooks and task-specific documents do not create new repo-wide blockers without owner approval.

## 2. Hard standing rules

- Never expose or commit secrets, credentials, cookies, sessions, tokens, private keys, database URLs, authorization headers, or private payloads.
- Never destructively overwrite another worker's branch, worktree, stash, staged, untracked, or uncommitted state.
- Production-destructive data/schema/security-policy changes require owner approval.
- Do not merge on `CI_EXECUTED_FAILURE` or `CI_PENDING_EXECUTION`.
- `CI_UNAVAILABLE_INFRA` is not a code failure; use the documented alternative-evidence path.
- Verify exact expected head and squash merge.
- Never close #1882; use `Refs #1882` only.

## 3. Default execution roles

```text
Web CTO
Web Developer
Local Validation when required
```

Lifecycle:

```text
user request
→ Web CTO contract
→ separate Web Developer implementation
→ Local Validation only when required
→ Web CTO independent final review
→ user decision / expected-head squash merge
```

### Web CTO

Owns remote verification, product/architecture/design contract, scope, risk classification, tests/evidence, final review, READY/NOT_READY, and merge judgment.

### Web Developer

Works in a separate web context. Owns feature-branch implementation, focused tests, PR maintenance, CI correction, and exact evidence. Does not make final merge/product decisions.

### Local Validation

Runs exact-head local/environment/browser/auth/database/provider/OS evidence only when required. It is not the default coder or UI designer.

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

JavaScript, auth, API/data, cache/storage, routing, forms, persistence, privacy/security, or runtime accessibility uses the full relevant path.

Escalate U0/U1 if the actual change affects DOM/focus/visibility semantics, broad shared/global files, dependencies, runtime state, privacy, or security.

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

Browser requests should use same-origin `/api/*` when possible.

## 7. Browser and Production verification

Evidence levels:

```text
LOCAL_EVIDENCE
PRE_MERGE_EVIDENCE
PRODUCTION_EVIDENCE
```

- Browser tooling, login, navigation, DevTools, Playwright, screenshots, preview, fixed slot, localhost, and Production are allowed.
- Preview/fixed slot is optional evidence unless explicitly assigned.
- Do not search for preview URLs or deploy fixed slots by habit.
- Merge-first Production verification is the current default.
- Dynamic/auth/API pages cannot be fully proven by a static local server; report limitations.
- Evidence scope follows U0/U1/U2/U3 risk.

## 8. CI

Use exactly:

```text
CI_GREEN
CI_EXECUTED_FAILURE
CI_PENDING_EXECUTION
CI_UNAVAILABLE_INFRA
```

Red workflow appearance alone is not enough to classify an executed failure. Inspect whether relevant steps ran.

## 9. Branch and parallel safety

- Never edit/push `main` directly.
- Use feature branches and PRs.
- One active writer per remote branch.
- Separate worktrees for simultaneous local work.
- Split parallel work by non-overlapping files/surfaces/responsibilities.
- Re-check remote head before push and expected head before merge.
- Do not force-push or destructively clean/reset/stash-drop without approval.

For U0/U1, small reversible micro branches/PRs are preferred.

## 10. Current local execution environment

- **Primary OS:** Windows.
- **Preferred shell:** PowerShell 7 through `pwsh.exe`.
- Use Windows-native tools and paths by default.
- WSL은 현재 task 또는 operator가 명시적으로 승인한 경우에만 사용한다. WSL은 implicit fallback이 아니다.
- 필수 Windows-native 도구가 없으면 중단하고 보고한다. WSL로 자동 우회하지 않는다.
- Codex, Kilo, Hermes 등 도구 정체성만으로 WSL/bash를 추론하지 않는다.

Detailed source: `docs/ops/PATHS_AND_SHELLS.md`.

Do not print secret files or environment values. Report presence/status only.

## 11. Operational input and image handling

- Pasted completion reports, logs, and command results from another executor or model are decision inputs, not automatically trusted completion evidence.
- The Web CTO or current reviewer independently verifies remote SHA, cumulative diff, changed files, CI, comments, and the underlying evidence.
- Attached images are analysis, comparison, and review material by default.
- Generate or transform images only when the user explicitly requests image generation or transformation; mentioning an image alone is not such a request.

## 12. Test selection

Tests are selected by affected behavior and blast radius.

- U0: exact diff + syntax/static/focused copy check when relevant.
- U1: exact selector/token delta + focused CSS/static check when available.
- U2: focused structural/layout/accessibility tests and conditional browser evidence.
- U3/backend/data/auth/security: full relevant runtime/regression evidence.

Do not require unrelated `lint/build/test/verify` commands solely because an HTML/CSS file changed.

Always distinguish:

- implemented versus already present;
- focused checks versus CI versus browser evidence;
- pristine-main versus branch-only failures;
- verified versus unverified;
- Local required versus skipped;
- merge candidate versus merged;
- merge versus Issue closure.

## 13. Session startup

Recommended order:

1. `AGENTS.md`
2. `docs/ops/MVP_AGENT_GOVERNANCE.md`
3. `docs/project/project_index.md`
4. `docs/project/WEB_CTO_WEB_DEVELOPER_LOCAL_VALIDATION.md`
5. `docs/project/UI_RAPID_ITERATION_LANE.md` for UI work
6. relevant product/design/engineering/ops documents
7. current remote Issue/PR/diff/CI evidence

## 14. Key detailed documents

- `docs/project/ROLE_SESSION_TEMPLATES.md`
- `docs/project/BRANCHING_AND_REVIEW.md`
- `docs/project/LOCAL_MODEL_WORKFLOW.md`
- `docs/project/VERIFICATION_AND_EVIDENCE.md`
- `docs/project/AGENT_OPERATION_GUARDRAILS.md`
- `docs/ops/PR_CHECKLIST.md`
- `docs/ops/MERGE_FIRST_PRODUCTION_VERIFICATION_WORKFLOW.md`
- `docs/ops/UI_SCREENSHOT_CTO_REVIEW_POLICY.md`
- `docs/engineering/CODE_ARCHITECTURE.md`
- `docs/engineering/REVIEW_GUARDRAILS.md`

## 15. One-line operating rule

```text
verify current remote state
→ classify real risk
→ use the smallest safe implementation/evidence path
→ independently review exact head
→ squash merge
→ confirm affected Production behavior
```

Refs #3664.
Refs #3662.
Refs #1882 — Keep OPEN.
