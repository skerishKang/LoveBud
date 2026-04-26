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
- 기준 main 커밋: `c8b96c126d5552aa03fc782abcf4e173420ecc8d`

| 구분 | 상태 | 기준/대상 | 현재 기록 |
|------|------|-----------|-----------|
| 문서 TF | 완료 | PR #8, #10, #32, #33, #50, #52, #54~#58, #61, #70 | project/ops/design 문서, 검증 기준, public-first 정책, QA matrix, warning catalog, branch cleanup plan, runtime active/legacy clarification main 반영 완료 |
| Runtime routing truth | 완료 | PR #70 `docs(runtime): clarify active and legacy runtime paths` | Cloudflare Pages 공식 사용자-facing entry, Modal active compute/runtime 우선 경로, Netlify legacy/fallback/artifact 기준 문서화 완료. Merge SHA: `1833aaf2c779bd593bda2687d5ee0df0e4197bfd` |
| Public layout UI | 완료 | PR #49 `ui(layout): align landing browse rails` | layout rail / container / spacing 통일 완료. production verification PASS. Merge SHA: `dfb158a843932edeaaf7c859d0fa3e2d06c9be08` |
| Typography / accent hierarchy | 완료 | PR #51 `ui(style): align typography accent hierarchy` | typography / accent hierarchy 통일 완료. production verification PASS. Merge SHA: `99af8a69fbe1cf61ac23017b938027164a213b3a` |
| Button / badge / chip tone | 완료 | PR #62 `ui(style): align button badge chip tone` | Home / Intro / Browse button, badge, chip tone 통일 완료. production verification PASS. Merge SHA: `ae5ac03a2e9582c6c5cef6a965d6600ec6fa8e44` |
| Intro hero visual / whitespace | 완료 | PR #63 `ui(intro): balance hero visual whitespace` | Intro hero visual column, tree scene height, tablet breakpoint, warm scrapbook tone 개선 완료. production verification PASS. Merge SHA: `7e287bb6e77e91d9a1c33681e7308f2e54f7022d` |
| Browse card / hub panel surface | 완료 | PR #66 `ui(search): unify browse card and hub surfaces` | Browse/Search card, preview sidebar, growing section, placeholder tone 정리 완료. production smoke 기준 main 반영 완료 |
| Search URL state | 완료 | PR #67 상당 직접 squash commit | `q`, `category`, `sort`, `limit` URL state sync main 반영 완료. Current main history includes `01408fbb87805083b08e77974351c9fa17c0d0f9`; PR #67은 중복 merge 방지를 위해 closed / unmerged 처리됨 |
| YouTube thumbnail fallback | 완료 | PR #69 `fix(search): harden YouTube thumbnail fallback` | failed card thumbnails hide broken image and show fallback surface; preview fallback overlay obstruction removed. Merge SHA: `5f0708c82c6a909f11dbe4fc31776adfd0504778` |
| CI/E2E Playwright dependency stabilization | 완료 | PR #68 상당 직접 squash commit | `playwright` dev dependency, lockfile, CI E2E smoke `npm ci` 변경 main 반영 완료. PR #68은 중복 merge 방지를 위해 closed / unmerged 처리됨 |
| UI verification rules | 완료 | PR #50 `docs(project): clarify UI verification environment rules` | UI verification environment rules 문서화 완료 |
| Test preview slot rules | 완료 | PR #52 `docs(ops): test preview slot branch rules` | test preview slot branch rules 문서화 완료. Merge SHA: `bbc988041e248d171a8560419dc739394ba4e23f` |
| Local generated artifact ignore | 완료 | PR #53 `chore: ignore local generated artifacts` | local generated artifacts `.gitignore` 정리 완료. Merge SHA: `5f8d185cde4b1d46df75a8c4382fd71a4a671ca8`. prototype/reference 보존 대상 침범 없음 |
| Task status tracking | 진행 중 | current docs cleanup branch | PR #64는 stale close됨. 현재 문서는 PR #69 / #70 이후 main 기준과 open PR 현황을 맞추는 중 |
| Prototype reference preservation | 완료 | PR #55 `docs(design): preserve prototype reference folders` | prototype/reference preservation policy 문서화 완료. PR #7 보존 정책 문서화 완료. Merge SHA: `1f1c0758d9307e8e090386d21b21a265e5fe257b` |
| Known CI/E2E blockers | 완료 | PR #56 `docs(ops): document known CI and E2E blockers` | known CI/E2E blockers 문서화 완료. Merge SHA: `c67956a23f61ea26dfb47e64813d340d960985ba` |
| UI polish roadmap | 완료 | `docs/design/UI_POLISH_ROADMAP.md` | PR #69 / PR #70 이후 남은 Issue #65 backlog 3개와 Search 후속 범위 분리 완료 |
| Verification warning catalog | 완료 | PR #58 `docs(project): add verification warning catalog` | verification warning catalog 문서화 완료. Merge SHA: `7e221b8829500c26a7542481bea1585d916fb14a` |
| 기능 TF | 완료 | `feature/search-growing-trees-api` | main과 동일 상태 (Identical). PR 생성 불필요. `/api/community/growing-trees` 운영 quick check 통과. 기능 TF 종료 |
| SVG Tree Prototype | 진행 중 | PR #7 `experiment: SVG tree prototype` | open / draft. SVG tree prototype. prototype/reference 보존 대상. merged 아님. 정식 기능 아님. close 금지. branch 삭제 금지. navigation 연결 금지 |
| JS architecture cleanup | 보류 | Issue #72 / PR #73 | Issue #72는 open이며 current status는 paused. PR #73은 closed / unmerged. file-move refactor는 clean worktree와 단일 executor 조건 충족 전 재개 금지 |
| Editor UI polish | 진행 중 | PR #74 `ui(editor): polish editor surface and empty states` | open / non-draft. `css/editor.css` + `js/i18n/i18n-editor.js` 변경. Cloudflare Preview 배포는 성공했으나 Preview verification pending 및 `git diff --check` trailing whitespace warning 확인 필요. 완료로 기록하지 않음 |

---

## Runtime / Backend 상태 메모

- Current production/test slot runtime: `Cloudflare Pages same-origin /api/* → Cloudflare Pages Functions → Modal`.
- Cloudflare Pages는 공식 사용자-facing production / preview entry입니다.
- Modal은 active compute/runtime 우선 경로입니다.
- `netlify/functions/*`는 legacy / fallback / artifact 성격으로 남아 있으며 현재 `lovebud.pages.dev` production/test slot active backend가 아닙니다.
- CI/E2E에서 `netlify dev`가 쓰이는 경우에도 이는 local harness이며 production runtime truth가 Netlify라는 뜻이 아닙니다.
- Netlify archive는 즉시 수행하지 않습니다. tests/docs reference transition 후 별도 승인 필요합니다.

---

## 다음 예정 작업 / Issue #65 Backlog

Issue #65는 open backlog tracker이며, 현재 미완료 항목은 아래 3개입니다.

| 작업 | 상태 | 메모 |
|------|------|------|
| Selected tree deep link | 대기 | `?tree=<treeId>` 직접 진입 시 공개 tree preview 선택. desktop / mobile preview 동작 확인 필요 |
| Search JS responsibility split | 보류 | JS architecture cleanup paused 상태. Search file-move 재개 전 clean worktree / 단일 executor / Preview 검증 조건 필요 |
| Search CSS extraction / inline style reduction | 대기 | PR5 이후 `pages/search.html` 내부 style 및 inline style 단계적 정리. Search JS refactor와 혼합 금지 |

---

## PR #64 / PR #73 정리 기록

- PR #64 `docs(project): update backlog after PR63`는 docs-only 범위 자체는 안전했으나 PR #63 직후 기준으로 작성되어 현재 main / Issue #65와 불일치했습니다.
- PR #69 / PR #70 이후 완료 상태를 반영하지 못하므로 stale 사유로 closed / unmerged 처리되었습니다.
- PR #64 head branch는 삭제하지 않았습니다.
- PR #73 `refactor(search): group search page scripts`는 closed / unmerged 처리되었습니다.
- PR #73은 preview behavior 검증은 있었으나 branch pollution / merge conflict / operational risk 때문에 병합하지 않았고, JS architecture cleanup은 Issue #72 기준 paused 상태입니다.

---

## 작업 이력 (Task History)

- 2026-04-26: PR #74 `ui(editor): polish editor surface and empty states` opened. Editor UI polish 진행 중. 완료 아님. Preview verification pending
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
- 2026-04-26: PR #54 `docs(project): update task status after PR49 and PR50` merged / closed. TASK_STATUS 이전 최신화 완료. Merge SHA `0a5386eea7e6c7921164c956e8946f06ca25fe37`
- 2026-04-26: PR #53 `chore: ignore local generated artifacts` repaired 후 merged / closed. Changed file `.gitignore` only. Merge SHA `5f8d185cde4b1d46df75a8c4382fd71a4a671ca8`. prototype/reference 보존 대상 침범 없음
- 2026-04-26: PR #52 `docs(ops): test preview slot branch rules` merged / closed. Changed file `docs/ops/TEST_PREVIEW_SLOTS.md` only. Merge SHA `bbc988041e248d171a8560419dc739394ba4e23f`
- 2026-04-26: PR #51 `ui(style): align typography accent hierarchy` merged / closed. typography / accent hierarchy 통일 완료. production verification PASS. Merge SHA `99af8a69fbe1cf61ac23017b938027164a213b3a`
- 2026-04-26: PR #50 `docs(project): clarify UI verification environment rules` main 병합 완료. UI verification environment rules 문서화 완료
- 2026-04-26: PR #49 `ui(layout): align landing browse rails` main 병합 및 production verification PASS. Merge SHA `dfb158a843932edeaaf7c859d0fa3e2d06c9be08`
- 2026-04-26: PR #7 `experiment: SVG tree prototype` open/draft 상태 보존. close 금지, branch 삭제 금지, navigation 연결 금지
- 2026-04-24: `feature/search-growing-trees-api` 운영 quick check 통과 및 기능 TF 종료
