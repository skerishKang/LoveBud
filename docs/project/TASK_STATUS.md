# Task Status

## 목적

이 문서는 LoveBud project 작업 상태를 기록하기 위한 전용 문서입니다.

## 상태 필드

- **완료**: 검증 및 병합이 완료되어 실서비스에 반영되거나 TF 작업이 종료된 상태
- **진행 중**: 현재 작업이 진행 중이거나 PR이 열려 있는 상태
- **대기**: 설계 중이거나 다음 단계로 예정된 작업
- **보류**: 작업이 중단되거나 지연된 상태

## 원칙

- 상태 필드 기준으로만 관리합니다.
- 정책이나 상세 운영 가이드는 이 문서에 포함하지 않습니다. (관련 문서 링크 활용)
- 수정, 검증, 추정은 구분하여 기록합니다.
- 세부 검증 기준은 [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)를 따릅니다.

---

## 현재 상태 스냅샷

- 기준일: 2026-04-26
- 기준 main 커밋: `07efce659ec13b2342d116ac0b43af9181cded3b`

| 구분 | 상태 | 기준/대상 | 현재 기록 |
|------|------|-----------|-----------|
| 문서 TF | 진행 중 | PR #127 이후 status/CI/screenshot refresh | PR #127 runtime guardrail 문서 병합 완료. 본 문서 refresh는 별도 docs-only PR에서 진행 |
| Runtime routing truth | 진행 중 | PR #70, PR #127, Issue #119 | Cloudflare Pages + Modal active runtime 기준은 문서화됨. Netlify는 Legacy Artifact Only / Removal Candidate로 정리됨. 최종 route 제거/보존 판단은 Issue #119 audit 이후 |
| CI / contract test baseline | 완료 | PR #111 | stale contract tests와 i18n scan 범위 정리 완료. `npm test`, `npm run verify`, `npm run ci` green baseline 보고됨. 과거 `56/61` 기준은 현행 기준 아님 |
| Screenshot evidence tooling | 완료 | PR #115 | `test:screenshots:xg`가 cross-platform `--prefix` 방식으로 정리됨 |
| Accessibility micro-fix | 완료 | PR #110 | Editor title edit button aria-label 추가 완료 |
| Detail CSS ownership cleanup | 완료 | PR #112, PR #120 | detail page-specific CSS ownership 정리. global 중복/잔여 detail rule 축소 완료 |
| Login CSS cleanup | 완료 | PR #113 | login inline style refactor 완료. JS-controlled display styles preserved |
| i18n production key cleanup | 완료 | PR #114 | production verification 중 발견된 editor/detail i18n missing keys 추가 완료 |
| Search URL state cleanup | 완료 | PR #121 | orphan debug log와 duplicate restore call 제거. URL state behavior 변경 없음 |
| Dependency classification audit | 완료 | Issue #117 | `dotenv`/`playwright`는 devDependencies 유지, `firebase-admin`/`pg`는 dependencies 유지. package change / PR 불필요 결론 |
| API client namespace audit | 진행 중 | Issue #116 | `window.apiClient`와 `__LoveBudApiClientInternals` 노출 범위 audit open. 구현/문서 확정은 audit 이후 |
| Cache lifecycle audit | 완료 | Issue #118 | cache-utils lifecycle / serialization audit completed. 구현 변경 여부는 별도 CTO 판단 필요 |
| Runtime routing transitional layers audit | 진행 중 | Issue #119 | Cloudflare/Vercel/Netlify transitional route ownership audit open. runtime routing 문서 본문 변경은 audit 이후 |
| SVG Tree Prototype | 진행 중 | PR #7 `experiment: SVG tree prototype` | open / draft. prototype/reference 보존 대상. merged 아님. 정식 기능 아님. close 금지. branch 삭제 금지. navigation 연결 금지 |
| JS architecture cleanup | 보류 | Issue #72 / PR #73 | Issue #72는 open이며 current status는 paused. PR #73은 closed / unmerged. file-move refactor는 clean worktree와 단일 executor 조건 충족 전 재개 금지 |
| Issue #65 Search backlog | 진행 중 | Issue #65 | Search JS responsibility split, broader Search CSS extraction은 backlog/open 상태 유지. Selected tree deep link는 PR #83에서 merged 완료 |

---

## Runtime / Backend 상태 메모

- Current production/test slot runtime: `Cloudflare Pages same-origin /api/* → Cloudflare Pages Functions → Modal`.
- Cloudflare Pages는 공식 사용자-facing production / preview entry입니다.
- Modal은 active compute/runtime 우선 경로입니다.
- Vercel은 deprecated transitional fallback / audit 대상입니다.
- `netlify/functions/*`는 Legacy Artifact Only / Removal Candidate이며 현재 `lovebud.pages.dev` production/test slot active backend 또는 active fallback이 아닙니다.
- Netlify route gap은 즉시 구현 blocker가 아니며 Issue #119 runtime routing audit에서 제거/보존 여부를 판단합니다.
- Netlify archive는 즉시 수행하지 않습니다. tests/docs reference transition 및 audit 후 별도 승인 필요합니다.

---

## 다음 예정 작업 / Issue #65 Backlog

Issue #65는 open backlog tracker이며, 현재 미완료 항목은 아래 2개입니다.

| 작업 | 상태 | 메모 |
|------|------|------|
| Search JS responsibility split | 보류 | JS architecture cleanup paused 상태. Search file-move 재개 전 clean worktree / 단일 executor / Preview 검증 조건 필요 |
| Search CSS extraction / inline style reduction | 진행 중 | PR #80 이후 여러 CSS extraction/cleanup PR이 진행됨. 더 넓은 Search JS refactor와 혼합 금지 |

---

## Audit 상태

| Issue | 상태 | 문서 반영 판단 |
|------|------|----------------|
| #116 API client global namespace exposure | 진행 중 | `window.apiClient` / `__LoveBudApiClientInternals` browser namespace contract는 audit 이후 문서화 |
| #117 dependency classification | 완료 | package 변경 없음. 상태 기록만 유지 |
| #118 cache-utils lifecycle and serialization behavior | 완료 | audit completed. 후속 구현/문서화는 별도 CTO 판단 필요 |
| #119 runtime routing transitional layers | 진행 중 | runtime routing 본문 문서는 audit 이후 갱신 |

---

## PR #64 / PR #73 정리 기록

- PR #64 `docs(project): update backlog after PR63`는 docs-only 범위 자체는 안전했으나 PR #63 직후 기준으로 작성되어 현재 main / Issue #65와 불일치했습니다.
- PR #69 / PR #70 이후 완료 상태를 반영하지 못하므로 stale 사유로 closed / unmerged 처리되었습니다.
- PR #64 head branch는 삭제하지 않았습니다.
- PR #73 `refactor(search): group search page scripts`는 closed / unmerged 처리되었습니다.
- PR #73은 preview behavior 검증은 있었으나 branch pollution / merge conflict / operational risk 때문에 병합하지 않았고, JS architecture cleanup은 Issue #72 기준 paused 상태입니다.

---

## 작업 이력 (Task History)

- 2026-04-26: PR #128 `cleanup(editor): move presentation inline styles to editor css` merged / closed. Editor presentation-only inline styles를 `css/editor.css`로 이동. Merge SHA `07efce659ec13b2342d116ac0b43af9181cded3b`
- 2026-04-26: PR #83 `feat(search): support selected tree deep link` merged / closed. `/pages/search.html?tree=<treeId>` 직접 진입 시 공개 tree preview 선택 지원. Merge SHA `48b1a5ebd62ac8ddabbdc9c0622a4de2a5123bd5`
- 2026-04-26: PR #127 `docs(runtime): clarify Netlify legacy removal guardrails` merged / closed. OPERATIONS / REVIEW_GUARDRAILS에 Netlify Legacy Artifact Only / Removal Candidate 기준 반영. Merge SHA `d48b9fd6f49724255c85bb423145c6e2a6846008`
- 2026-04-26: PR #121 `cleanup(search): remove orphan debug comment and duplicate restore call` merged / closed. Search URL state cleanup 완료
- 2026-04-26: PR #120 `cleanup(detail): move memory title mobile rule to detail css` merged / closed. detail #memoryTitle mobile rule ownership 이동 완료
- 2026-04-26: Issue #119 `Audit: runtime routing transitional layers` opened. Cloudflare/Vercel/Netlify transitional route ownership audit tracker
- 2026-04-26: Issue #118 `Audit: cache-utils lifecycle and serialization behavior` completed. cache lifecycle / serialization audit 종료
- 2026-04-26: Issue #117 `Audit: dependency classification for server and tooling packages` closed. dependency classification 현 상태 유지 결론
- 2026-04-26: Issue #116 `Audit: API client global namespace exposure` opened. browser API namespace exposure audit tracker
- 2026-04-26: PR #115 `chore(scripts): make screenshot script cross-platform` merged / closed. `test:screenshots:xg`를 `--prefix xg-test` 방식으로 정리
- 2026-04-26: PR #114 `fix(i18n): add missing production keys` merged / closed. editor/detail missing production i18n keys 추가
- 2026-04-26: PR #113 `cleanup(login): refactor inline styles to css classes while preserving encoding` merged / closed. login CSS refactor 완료
- 2026-04-26: PR #112 `cleanup(detail): remove redundant moment card image rule from global css` merged / closed. detail/global 중복 CSS rule 정리
- 2026-04-26: PR #111 `fix: resolve CI known failures in contract tests (stale string matches)` merged / closed. contract tests / pre-deploy i18n scan / missing keys 정리. green baseline 보고
- 2026-04-26: PR #110 `fix(editor): add aria-label to sidebarTitleEditBtn` merged / closed. editor accessibility micro-fix 완료
- 2026-04-26: PR #80 `ui(search): reduce preview inline styles` squash merged / closed. Search inline style reduction pass 1 main 반영 완료. Merge SHA `0da436d57c9628e1e72d960d9d814844f4079d98`. Cloudflare Preview verification PASS. Production verification pending
- 2026-04-26: Issue #79 `Audit: Runtime ownership and legacy folder guardrails` opened. active/legacy runtime marker docs 후보로 추적
- 2026-04-26: Issue #78 `Audit: Auth architecture, global exports, and token cache cleanup` opened. Auth architecture/security audit tracker로 추적
- 2026-04-26: PR #77 `docs(ops): clarify preview slot verification rules` merged / closed. docs/ops 3 files 반영 완료. Merge SHA `6fe90fbef24f7348a1f6b247891e62ba871a5c3b`
- 2026-04-26: PR #76 `docs(project): align document indexes and runtime truth` merged / closed. docs-only 7 files cleanup 완료. Merge SHA `e447cb903f671afbccb5623a02a71d965a4c58f8`
- 2026-04-26: PR #74 `ui(editor): polish editor surface and empty states` merged / closed. Editor surface polish main 반영 완료. Merge SHA `90933a4961b240df2caa7f04b737322b22200f26`
- 2026-04-26: Issue #72 `JS Architecture Cleanup Tracker` updated. JS architecture cleanup paused. PR #73 closed / unmerged
- 2026-04-26: PR #70 `docs(runtime): clarify active and legacy runtime paths` merged / closed. Cloudflare Pages / Modal / Netlify active/legacy runtime truth 문서화 완료. Merge SHA `1833aaf2c779bd593bda2687d5ee0df0e4197bfd`
- 2026-04-26: PR #69 `fix(search): harden YouTube thumbnail fallback` merged / closed. YouTube thumbnail fallback hardening 완료. Merge SHA `5f0708c82c6a909f11dbe4fc31776adfd0504778`
- 2026-04-26: PR #68 `chore(ci): stabilize Playwright E2E dependency` 상당 변경 main 직접 squash 반영 후 PR closed / unmerged. Playwright dependency blocker 정리 완료
- 2026-04-26: PR #67 `feat(search): sync browse controls with URL state` 상당 변경 main 직접 squash 반영 후 PR closed / unmerged. Search URL state 완료
- 2026-04-26: PR #66 `ui(search): unify browse card and hub surfaces` merged / closed. Browse/Search surface tone 정리 완료
- 2026-04-26: PR #64 `docs(project): update backlog after PR63` closed / unmerged. stale docs PR로 정리됨
- 2026-04-26: PR #63 `ui(intro): balance hero visual whitespace` merged / closed. production verification PASS. Merge SHA `7e287bb6e77e91d9a1c33681e7308f2e54f7022d`
- 2026-04-26: PR #62 `ui(style): align button badge chip tone` merged / closed. production verification PASS. Merge SHA `ae5ac03a2e9582c6c5cef6a965d6600ec6fa8e44`
- 2026-04-26: PR #61 `docs(ops): add branch cleanup plan after PR58` merged / closed. Branch cleanup plan 문서화 완료. Merge SHA `7970f7c3997cc4d0f4585e8c1ae4b02895027d6f`
- 2026-04-26: PR #60 `docs(design): add button badge chip baseline` merged / closed. Button / badge / chip baseline 문서화 완료
- 2026-04-26: PR #59 `docs(project): update task status after PR58` merged / closed. TASK_STATUS 이전 최신화 완료
- 2026-04-26: PR #58 `docs(project): add verification warning catalog` merged / closed. Verification warning catalog 문서화 완료. Merge SHA `7e221b8829500c26a7542481bea1585d916fb14a`
- 2026-04-26: PR #57 `docs(project): add UI polish roadmap after PR51` merged / closed. UI polish roadmap after PR51 문서화 완료. Merge SHA `aaf31fe72298ddc510db29728ca8c35b2a808a5e`
- 2026-04-26: PR #56 `docs(ops): document known CI and E2E blockers` merged / closed. Known CI/E2E blockers 문서화 완료. Merge SHA `c67956a23f61ea26dfb47e64813d340d960985ba`
- 2026-04-26: PR #55 `docs(design): preserve prototype reference folders` merged / closed. docs-only. PR #7 보존 정책 문서화 완료. Merge SHA `1f1c0758d9307e8e090386d21b21a265e5fe257b`
- 2026-04-26: PR #54 `docs/project): update task status after PR49 and PR50` merged / closed. TASK_STATUS 이전 최신화 완료. Merge SHA `0a5386eea7e6c7921164c956e8946f06ca25fe37`
- 2026-04-26: PR #53 `chore: ignore local generated artifacts` repaired 후 merged / closed. Changed file `.gitignore` only. Merge SHA `5f8d185cde4b1d46df75a8c4382fd71a4a671ca8`. prototype/reference 보존 대상 침범 없음
- 2026-04-26: PR #52 `docs(ops): test preview slot branch rules` merged / closed. Changed file `docs/ops/TEST_PREVIEW_SLOTS.md` only. Merge SHA `bbc988041e248d171a8560419dc739394ba4e23f`
- 2026-04-26: PR #51 `ui(style): align typography accent hierarchy` merged / closed. typography / accent hierarchy 통일 완료. production verification PASS. Merge SHA `99af8a69fbe1cf61ac23017b938027164a213b3a`
- 2026-04-26: PR #50 `docs(project): clarify UI verification environment rules` main 병합 완료. UI verification environment rules 문서화 완료
- 2026-04-26: PR #49 `ui(layout): align landing browse rails` main 병합 및 production verification PASS. Merge SHA `dfb158a843932edeaaf7c859d0fa3e2d06c9be08`
- 2026-04-26: PR #7 `experiment: SVG tree prototype` open/draft 상태 보존. close 금지, branch 삭제 금지, navigation 연결 금지
- 2026-04-24: `feature/search-growing-trees-api` 운영 quick check 통과 및 기능 TF 종료
