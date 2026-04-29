# CSS Version / Prototype Folder Reference Map

## Purpose

이 문서는 LoveBud 저장소 내 CSS 파일의 버전/prototype/reference/demo/variant 관련 경로를 감사하고 현재 active 경로와 비교하는 audit 문서입니다.

- Issue #224 Auth/Editor fallback findings의 후속 CSS 파일 구조 감사
- 구현 PR이 아니라 현재 상태 파악과 향후 정리 기준을 제공하는 문서
- 실제 CSS 이동/삭제/통합은 이 문서 리뷰 후 별도 PR에서 수행

---

## Non-goals

- CSS 파일 이동/삭제 없음
- selector consolidation 없음
- property/value 변경 없음
- pages/editor.html 또는 다른 HTML 변경 없음
- JS 변경 없음
- PR #7/prototype/reference/demo/variant 파일 변경 없음

---

## Current Active CSS Structure

현재 `main` 기준 CSS 파일 구조는 `docs/engineering/CSS_ARCHITECTURE.md`를 source of truth로 합니다.

주요 active 경로:

| 경로 | 역할 |
|------|------|
| `css/global.css` | 공통 토큰, 공통 컴포넌트, 공통 레이아웃 |
| `css/editor/overrides.css` | Editor final cascade override (role-based relocation 감사 중 → `EDITOR_OVERRIDES_RELOCATION_AUDIT.md`) |
| `css/search.css` | Search/Browse 페이지 전용 |
| `css/detail.css` | Detail 페이지 전용 |
| `css/my-trees.css` | My Trees 페이지 전용 |
| `css/login.css` | Login 페이지 전용 |
| `css/intro.css` | Intro 페이지 전용 |

---

## Version / Prototype / Reference / Demo / Variant Folder Audit

### Audit Scope

아래 경로 패턴을 감사합니다.

- `css/v*/` — 버전 폴더
- `css/prototype*/` — 프로토타입 폴더
- `css/reference*/` — 레퍼런스 폴더
- `css/demo*/` — 데모 폴더
- `css/variant*/` — 변형 폴더
- `css/*-old*`, `css/*-backup*`, `css/*-legacy*` — 이름에 old/backup/legacy 포함
- PR #7 연결 경로 (별도 보존 대상)

### Current Finding

> **이 감사는 현재 main 기준 파일 목록을 직접 조회한 정적 스냅샷이 아닙니다.**
> 실제 파일 목록 확인은 `git ls-files css/` 또는 GitHub API 조회로 수행합니다.
> 이 문서는 감사 기준과 분류 정책을 제공합니다.

감사 결과는 아래 두 단계로 채워집니다:

1. **파일 목록 수집** (Code Executor 또는 Web/GitHub Executor)
2. **분류 및 문서 업데이트** (CTO 승인 후)

### Classification Policy

| 분류 | 정의 | 조치 |
|------|------|------|
| `active` | 현재 pages/*.html에서 직접 로드되는 파일 | 보존 필수 |
| `pr7-preserved` | PR #7/prototype/reference/demo/variant 경로 | 절대 보존, 수정 금지 |
| `orphan-candidate` | 어떤 HTML에서도 로드되지 않는 CSS | 별도 PR에서 제거 후보 검토 |
| `version-duplicate` | active 파일의 이전 버전 사본 | 별도 PR에서 제거 후보 검토 |
| `unknown` | 출처/용도 불명 | 추가 조사 필요 |

---

## Known Risk

- `css/editor/overrides.css`는 final cascade override 역할이므로 섣불리 이동/삭제 금지
- 버전/prototype 폴더가 실제로 존재하더라도 PR #7 보존 대상이면 수정 금지
- orphan-candidate 분류 후에도 실제 제거 전 반드시 CTO 승인 필요

---

## Future Implementation Gate

아래 조건이 모두 충족된 후에만 실제 파일 정리 PR을 진행합니다.

- [ ] `git ls-files css/` 전체 목록 수집 완료
- [ ] 각 파일의 HTML 로드 여부 확인 완료
- [ ] PR #7 보존 대상 파일 식별 완료
- [ ] orphan-candidate 목록 CTO 리뷰 완료
- [ ] editor browser smoke 통과
- [ ] Cloudflare Preview 또는 fixed slot 검증 완료

---

## Suggested Future PR Split

- **PR A**: `git ls-files css/` 수집 결과 + 분류 표 채우기 (docs-only)
- **PR B**: orphan-candidate 제거 (CTO 승인 후)
- **PR C**: version-duplicate 제거 (CTO 승인 후)
- **PR D**: visual verification pass

---

## Related

- Issue #224
- `docs/engineering/CSS_ARCHITECTURE.md` — active CSS import hub
- `docs/engineering/EDITOR_OVERRIDES_RELOCATION_AUDIT.md` — editor overrides 별도 감사
- `docs/engineering/GLOBAL_CSS_RGBA_TOKEN_AUDIT.md` — global.css RGBA token 감사 (별도 문서)

---

Last updated: 2026-04-29
