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
- 기준 main 커밋: `7e287bb6e77e91d9a1c33681e7308f2e54f7022d`

| 구분 | 상태 | 기준/대상 | 현재 기록 |
|------|------|-----------|-----------|
| 문서 TF | 완료 | PR #8, PR #10, PR #32, PR #33, PR #50, PR #52, PR #54, PR #55, PR #56, PR #57, PR #58 | project 운영 문서, 검증 기준, public-first 정책, Tree/Memory/Visibility/Delete QA matrix, UI verification environment rules, test preview slot branch rules, TASK_STATUS, prototype/reference preservation policy, known CI/E2E blockers, UI polish roadmap, verification warning catalog main 반영 완료 |
| Runtime routing truth | 진행 중 | production/test slot route matrix | `/api/trees`, `/api/memories`는 Cloudflare Pages Functions → Modal 경로로 실측. Netlify Functions 호출 흔적 없음. Netlify legacy deprecation 문서 정리 진행 중 |
| Public layout UI | 완료 | PR #49 `ui(layout): align landing browse rails` | layout rail / container / spacing 통일 완료. production verification PASS. Merge SHA: `dfb158a843932edeaaf7c859d0fa3e2d06c9be08` |
| Typography / accent hierarchy | 완료 | PR #51 `ui(style): align typography accent hierarchy` | typography / accent hierarchy 통일 완료. production verification PASS. Merge SHA: `99af8a69fbe1cf61ac23017b938027164a213b3a` |
| PR3 button / badge / chip tone | 완료 | PR #62 `ui(style): align button badge chip tone` | Home / Intro / Browse button, badge, chip tone 통일 완료. production verification PASS. Merge SHA: `ae5ac03a2e9582c6c5cef6a965d6600ec6fa8e44` |
| PR4 intro hero visual / whitespace | 완료 | PR #63 `ui(intro): balance hero visual whitespace` | Intro hero visual column, tree scene height, tablet breakpoint, warm scrapbook tone 개선 완료. production verification PASS. Merge SHA: `7e287bb6e77e91d9a1c33681e7308f2e54f7022d` |
| UI verification rules | 완료 | PR #50 `docs(project): clarify UI verification environment rules` | UI verification environment rules 문서화 완료 |
| Test preview slot rules | 완료 | PR #52 `docs(ops): test preview slot branch rules` | test preview slot branch rules 문서화 완료. Merge SHA: `bbc988041e248d171a8560419dc739394ba4e23f` |
| Local generated artifact ignore | 완료 | PR #53 `chore: ignore local generated artifacts` | local generated artifacts `.gitignore` 정리 완료. Merge SHA: `5f8d185cde4b1d46df75a8c4382fd71a4a671ca8`. prototype/reference 보존 대상 침범 없음 |
| Task status tracking | 진행 중 | PR #64 후보 `docs(project): update backlog after PR63` | PR #62 / PR #63 완료 상태와 다음 백로그 순서 반영 중 |
| Prototype reference preservation | 완료 | PR #55 `docs(design): preserve prototype reference folders` | prototype/reference preservation policy 문서화 완료. PR #7 보존 정책 문서화 완료. Merge SHA: `1f1c0758d9307e8e090386d21b21a265e5fe257b` |
| Known CI/E2E blockers | 완료 | PR #56 `docs(ops): document known CI and E2E blockers` | known CI/E2E blockers 문서화 완료. Merge SHA: `c67956a23f61ea26dfb47e64813d340d960985ba` |
| UI polish roadmap | 완료 | PR #57, PR #64 후보 | PR #49 / #51 / #62 / #63 이후 남은 public UI polish와 후속 backlog 순서 정리 중 |
| Verification warning catalog | 완료 | PR #58 `docs(project): add verification warning catalog` | verification warning catalog 문서화 완료. Merge SHA: `7e221b8829500c26a7542481bea1585d916fb14a` |
| 기능 TF | 완료 | `feature/search-growing-trees-api` | main과 동일 상태 (Identical). PR 생성 불필요. `/api/community/growing-trees` 운영 quick check 통과. 기능 TF 종료 |
| SVG Tree Prototype | 진행 중 | PR #7 `experiment: SVG tree prototype` | open / draft. SVG tree prototype. prototype/reference 보존 대상. merged 아님. 정식 기능 아님. close 금지. branch 삭제 금지. navigation 연결 금지 |

---

## Runtime / Backend 상태 메모

- Current production/test slot runtime: `Cloudflare Pages same-origin /api/* → Cloudflare Pages Functions → Modal`.
- `netlify/functions/*`는 legacy artifact only이며 현재 `lovebud.pages.dev` production/test slot active backend가 아닙니다.
- PR #38은 active Cloudflare/Modal runtime이 아니라 legacy `netlify/functions/*`를 대상으로 했기 때문에 close되었습니다.
- Netlify archive는 즉시 수행하지 않습니다. tests/docs reference transition 후 별도 승인 필요합니다.

---

## 다음 예정 작업 / Backlog

| 우선순위 | 작업 | 상태 | 메모 |
|------|------|------|------|
| 0 | TASK_STATUS / UI_POLISH_ROADMAP 최신화 | 진행 중 | PR #62 / #63 완료와 후속 backlog를 문서에 반영. docs-only |
| 1 | PR5 Browse card / hub panel surface audit | 대기 | 구현 전 실도메인 기준 Browse card, preview/sidebar, growing section surface를 감사. 코드 수정 없음 |
| 2 | PR5 Browse card / hub panel surface implementation | 대기 | audit 이후 별도 UI PR. Search JS/API/renderer/filtering/thumbnail 처리 변경 금지 |
| 3 | Search URL state | 대기 | 검색어, 카테고리, 정렬, limit 상태를 URL query와 동기화. 별도 기능 PR |
| 4 | Selected tree deep link | 대기 | `/pages/search.html?tree=...` 진입 시 해당 공개 트리 preview 선택 지원. Search URL state 이후 검토 |
| 5 | YouTube thumbnail fallback hardening | 대기 | 기존 `ytimg.com` 404 warning 정식 정리. UI polish와 분리된 bugfix PR |
| 6 | CI/E2E Playwright dependency stabilization | 대기 | 반복 `Cannot find module 'playwright'` blocker를 dependency/setup 차원에서 정리. package/workflow 영향 별도 검토 |
| 7 | Netlify legacy / Cloudflare-Modal runtime clarification | 진행 중 | active runtime truth 고정. 코드 이동/삭제 없이 문서 우선 |
| 8 | Search CSS extraction / inline style reduction | 대기 | PR5 이후 검토. `pages/search.html` 내부 style과 inline style을 단계적으로 분리 |
| 9 | Active Cloudflare/Modal public-first backend 설계 | 대기 | Netlify legacy deprecation 정리 후 별도 브랜치 필요 |
| 10 | PR #36 / #38 계열 backend 방향 재정렬 | 대기 | 신규 backend policy는 `netlify/functions/*`가 아닌 active Cloudflare/Modal runtime 대상으로 재설계 필요 |
| 11 | PR #7 재동기화 가능성 확인 | 대기 | prototype/reference 보존 상태 유지. main 병합 대상 아님. close/branch 삭제 금지 |

---

## 작업 이력 (Task History)

- 2026-04-26: PR #63 `ui(intro): balance hero visual whitespace` merged / closed. production verification PASS. Merge SHA `7e287bb6e77e91d9a1c33681e7308f2e54f7022d`
- 2026-04-26: PR #62 `ui(style): align button badge chip tone` merged / closed. production verification PASS. Merge SHA `ae5ac03a2e9582c6c5cef6a965d6600ec6fa8e44`
- 2026-04-26: PR #61 `docs(ops): add branch cleanup plan after PR58` merged / closed. Branch cleanup plan 문서화 완료
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
- 2026-04-25: production/test1/test2/test3 route matrix 기준 `/api/trees`, `/api/memories` active upstream이 Modal임을 확인. Netlify Functions는 legacy artifact로 정리 필요
- 2026-04-25: PR #32 public-first + Plus private policy direction 문서 반영 완료
- 2026-04-25: PR #33 Tree / Memory / Visibility / Delete QA Matrix 문서 반영 완료
- 2026-04-24: PR #9 production 검증 완료 및 UI TF 종료
- 2026-04-24: `feature/search-growing-trees-api` 운영 quick check 통과 및 기능 TF 종료
- 2026-04-24: project 운영 및 검증 기준 문서 동기화
