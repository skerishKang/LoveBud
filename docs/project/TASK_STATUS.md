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
- 기준 main 커밋: `3542a82c539805cc5c67556447339cba79f1280f`

| 구분 | 상태 | 기준/대상 | 현재 기록 |
|------|------|-----------|-----------|
| 문서 TF | 완료 | PR #8, PR #10, PR #32, PR #33, PR #50 | project 운영 문서, 검증 기준, public-first 정책, Tree/Memory/Visibility/Delete QA matrix, UI verification environment rules main 반영 완료 |
| Runtime routing truth | 진행 중 | production/test slot route matrix | `/api/trees`, `/api/memories`는 Cloudflare Pages Functions → Modal 경로로 실측. Netlify Functions 호출 흔적 없음. Netlify legacy deprecation 문서 정리 진행 중 |
| Public layout UI | 완료 | PR #49 `ui(layout): align landing browse rails` | main 병합 완료. production verification PASS. Merge SHA: `dfb158a843932edeaaf7c859d0fa3e2d06c9be08` |
| UI verification rules | 완료 | PR #50 `docs(project): clarify UI verification environment rules` | main 병합 완료. main HEAD: `3542a82c539805cc5c67556447339cba79f1280f` |
| Typography / accent hierarchy | 진행 중 | PR #51 `ui(style): align typography accent hierarchy` | open. test1 배포 트리거 완료. Gemini Local Verifier test1 검증 대기. PR #51 파일 수정 금지 |
| 기능 TF | 완료 | `feature/search-growing-trees-api` | main과 동일 상태 (Identical). PR 생성 불필요. `/api/community/growing-trees` 운영 quick check 통과. 기능 TF 종료 |
| SVG Tree Prototype | 진행 중 | PR #7 `experiment: SVG tree prototype` | open / draft. 보존 대상. merged 아님. 정식 기능 아님. close 금지. navigation 연결 금지 |

---

## Runtime / Backend 상태 메모

- Current production/test slot runtime: `Cloudflare Pages same-origin /api/* → Cloudflare Pages Functions → Modal`.
- `netlify/functions/*`는 legacy artifact only이며 현재 `lovebud.pages.dev` production/test slot active backend가 아닙니다.
- PR #38은 active Cloudflare/Modal runtime이 아니라 legacy `netlify/functions/*`를 대상으로 했기 때문에 close되었습니다.
- Netlify archive는 즉시 수행하지 않습니다. tests/docs reference transition 후 별도 승인 필요합니다.

---

## 다음 예정 작업

| 작업 | 상태 | 메모 |
|------|------|------|
| PR2 typography/accent 검증 | 진행 중 | PR #51 test1 검증 대기. Gemini Local Verifier 확인 후 merge 판단 |
| PR3 button/badge/chip | 대기 | PR #51 검증/병합 후 별도 UI PR로 진행 |
| PR4 intro hero visual/whitespace | 대기 | PR3 이후 별도 UI PR로 진행 |
| PR5 browse card/hub panel | 대기 | PR4 이후 별도 UI PR로 진행 |
| Netlify Functions legacy deprecation 문서 PR | 진행 중 | active runtime truth 고정. 코드 이동/삭제 없음 |
| Active Cloudflare/Modal public-first backend 설계 | 대기 | Netlify legacy deprecation 정리 후 별도 브랜치 필요 |
| PR #36 / #38 계열 backend 방향 재정렬 | 대기 | 신규 backend policy는 `netlify/functions/*`가 아닌 active Cloudflare/Modal runtime 대상으로 재설계 필요 |
| Search에 “새로 자라는 러브트리” 보조 섹션 설계 | 대기 | 설계 승인 후 별도 브랜치에서 진행 |
| PR #7 재동기화 가능성 확인 | 대기 | prototype 상태 유지. main 병합 대상 아님 |
| Search 보조 섹션 UI 구현 | 대기 | 설계 승인 이후 UI 구현 브랜치 분리 |

---

## 작업 이력 (Task History)

- 2026-04-26: PR #50 `docs(project): clarify UI verification environment rules` main 병합 완료. main HEAD `3542a82c539805cc5c67556447339cba79f1280f`
- 2026-04-26: PR #49 `ui(layout): align landing browse rails` main 병합 및 production verification PASS. Merge SHA `dfb158a843932edeaaf7c859d0fa3e2d06c9be08`
- 2026-04-26: PR #51 `ui(style): align typography accent hierarchy` open. test1 배포 트리거 완료, Gemini Local Verifier test1 검증 대기
- 2026-04-26: PR #7 `experiment: SVG tree prototype` open/draft 상태 보존. close 금지
- 2026-04-25: production/test1/test2/test3 route matrix 기준 `/api/trees`, `/api/memories` active upstream이 Modal임을 확인. Netlify Functions는 legacy artifact로 정리 필요
- 2026-04-25: PR #32 public-first + Plus private policy direction 문서 반영 완료
- 2026-04-25: PR #33 Tree / Memory / Visibility / Delete QA Matrix 문서 반영 완료
- 2026-04-24: PR #9 production 검증 완료 및 UI TF 종료
- 2026-04-24: `feature/search-growing-trees-api` 운영 quick check 통과 및 기능 TF 종료
- 2026-04-24: project 운영 및 검증 기준 문서 동기화
