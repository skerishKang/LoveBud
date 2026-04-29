# 제품 문서 인덱스

이 폴더에는 LoveBud 제품의 정의, 범위, 사용자 흐름, 정체성 등 **제품 관련 문서**가 저장됩니다.

## 용도
- 제품의 방향성과 범위 명시
- MVP 정의 및 사용자 여정
- 브랜드 정체성 및 디자인 원칙
- 팬페이지 기반 감성 UX / 페이지 경험 기준 정리
- 전역 UI 카피 운영 기준 정리
- public-first visibility / Plus private storage / anonymous public exposure / Browse/Search eligibility 정책 정리

## 파일 목록

| 파일명 | 설명 |
|--------|------|
| [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md) | LoveBud의 핵심 정체성과 public-first 감상 공간 원칙 |
| [BRAND_EXPERIENCE.md](BRAND_EXPERIENCE.md) | 팬 경험 중심 브랜드/UX 톤앤매너와 페이지별 감성 기준 |
| [PUBLICATION_AND_PRIVACY_UX_POLICY.md](PUBLICATION_AND_PRIVACY_UX_POLICY.md) | public-first visibility, Plus private storage, memory visibility inheritance, anonymous public exposure, Browse/Search eligibility 정책 |
<<<<<<< HEAD
| [MOMENT_TIMELINE_PLAN.md](MOMENT_TIMELINE_PLAN.md) | cue-based YouTube Moment Timeline product/technical plan |
| [YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md](YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md) | cue-based YouTube segment player PoC scope and Go/No-Go criteria |
| [MOMENT_CAPTURE_UI_DESIGN.md](MOMENT_CAPTURE_UI_DESIGN.md) | Moment capture UI flow design |
| [MOMENT_TIMELINE_PLAN.md](MOMENT_TIMELINE_PLAN.md) | cue-based YouTube Moment Timeline 제품/기술 계획 |
=======
| [MOMENT_TIMELINE_REORDER_DESIGN.md](MOMENT_TIMELINE_REORDER_DESIGN.md) | Moment Timeline reorder / sequence editor design |
<<<<<<< HEAD
>>>>>>> 0e0c994 (docs(product): link Moment Timeline reorder design)
=======
| [MOMENT_TIMELINE_PLAN.md](MOMENT_TIMELINE_PLAN.md) | cue-based YouTube Moment Timeline 제품/기술 계획 |
>>>>>>> 1ad8f73 (Reconcile product_index.md: include both MOMENT_TIMELINE_REORDER_DESIGN.md and MOMENT_TIMELINE_PLAN.md)
| [UI_COPY_DIET_GUIDE.md](UI_COPY_DIET_GUIDE.md) | 전역 UI 카피 다이어트 운영 기준 |
| [MVP_SCOPE.md](MVP_SCOPE.md) | MVP 범위 및 포함/제외 항목 |
| [USER_FLOW.md](USER_FLOW.md) | 주요 사용자 여정 및 플로우 |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | 현재 실행 기준 제품 개요 |
| [DATA_NAMING_RULE.md](DATA_NAMING_RULE.md) | 데이터 명명 규칙 |
| [READONLY_SHARE_SCOPE.md](READONLY_SHARE_SCOPE.md) | 읽기 전용 공유 범위 |
| [VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md](VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md) | visibility/private storage 정책 검토 |

## Canonical policy highlights

현재 제품 visibility / anonymous public exposure / Browse/Search 소개 정책의 핵심은 다음과 같습니다.

- 신규 tree는 정책상 `public`으로 시작합니다.
- private storage는 Plus entitlement가 필요합니다.
- memory visibility가 생략되면 parent tree visibility를 상속합니다.
- explicit memory visibility는 backend policy가 허용하는 범위에서만 inheritance를 override할 수 있습니다.
- private tree 아래 explicit public memory는 저장될 수 있습니다.
- stored memory visibility와 anonymous public exposure는 별개입니다.
- anonymous public read는 `memory.visibility = public`과 `parent tree.visibility = public`을 모두 요구합니다.
- public visibility와 Browse/Search eligibility는 별개입니다.
- Browse/Search introduction은 `publicMomentCount >= 3`이 필요합니다.
- private tree 아래 public memory가 가능하더라도 Browse/Search, community memories list, public memory detail read 노출은 parent tree visibility guard를 함께 봅니다.
- owner/private read는 private access policy에 따라 private tree 아래 public/private memory를 조회할 수 있습니다.

## 원천 자료 (Identity Source)

제품 정체성의 기반이 된 인터뷰 및 콘셉트 원본 문서:

| 파일명 | 설명 |
|--------|------|
| [identity-source/relovetree-concept-interview-answer.txt](identity-source/relovetree-concept-interview-answer.txt) | Relovetree 정체성 인터뷰 답변 원본 (txt) |
| [identity-source/concept-interview.html](identity-source/concept-interview.html) | 인터뷰 내용 포맷된 HTML |

## 먼저 읽기 순서

이 폴더의 문서를 처음 접할 때 권장하는 순서:

1. **PRODUCT_IDENTITY.md** — 제품 철학과 핵심 가치
2. **BRAND_EXPERIENCE.md** — 팬 감성 UX / 톤앤매너 / 페이지별 표현 원칙
3. **PUBLICATION_AND_PRIVACY_UX_POLICY.md** — public-first visibility / Plus private storage / anonymous public exposure / Browse/Search eligibility 정책
<<<<<<< HEAD
<<<<<<< HEAD
4. **MOMENT_TIMELINE_PLAN.md** - cue-based Moment Timeline plan
5. **YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md** - YouTube segment player PoC scope and verification criteria
6. **MOMENT_CAPTURE_UI_DESIGN.md** - Moment capture UI flow design
7. **UI_COPY_DIET_GUIDE.md** - global UI copy diet guidelines
8. **MVP_SCOPE.md** - MVP scope and In/Out of Scope
9. **USER_FLOW.md** - user journey and key flows
10. **PRODUCT_BRIEF.md** - current execution-based summary
11. If needed, DATA_NAMING_RULE.md, READONLY_SHARE_SCOPE.md
=======
4. **MOMENT_CAPTURE_UI_DESIGN.md** — Moment capture UI flow 설계
5. **MOMENT_TIMELINE_PLAN.md** — cue-based Moment Timeline 계획
6. **UI_COPY_DIET_GUIDE.md** — 전역 UI 카피 다이어트 기준
7. **MVP_SCOPE.md** — MVP 범위 및 In/Out of Scope
8. **USER_FLOW.md** — 사용자 여정 및 핵심 플로우
9. **PRODUCT_BRIEF.md** — 현재 실행 기준 요약
10. 필요시 DATA_NAMING_RULE.md, READONLY_SHARE_SCOPE.md
>>>>>>> 30955f0 (Reconcile product_index.md: include both MOMENT_CAPTURE_UI_DESIGN.md and MOMENT_TIMELINE_PLAN.md)
=======
4. **MOMENT_TIMELINE_REORDER_DESIGN.md** — Moment Timeline reorder / sequence editor 설계
<<<<<<< HEAD
5. **UI_COPY_DIET_GUIDE.md** — 전역 UI 카피 다이어트 기준
6. **MVP_SCOPE.md** — MVP 범위와 In/Out of Scope
7. **USER_FLOW.md** — 사용자 여정과 핵심 플로우
8. **PRODUCT_BRIEF.md** — 현재 실행 기준 요약
9. 필요시 DATA_NAMING_RULE.md, READONLY_SHARE_SCOPE.md
>>>>>>> 0e0c994 (docs(product): link Moment Timeline reorder design)
=======
5. **MOMENT_TIMELINE_PLAN.md** — cue-based Moment Timeline 계획
6. **UI_COPY_DIET_GUIDE.md** — 전역 UI 카피 다이어트 기준
7. **MVP_SCOPE.md** — MVP 범위 및 In/Out of Scope
8. **USER_FLOW.md** — 사용자 여정 및 핵심 플로우
9. **PRODUCT_BRIEF.md** — 현재 실행 기준 요약
10. 필요시 DATA_NAMING_RULE.md, READONLY_SHARE_SCOPE.md
>>>>>>> 1ad8f73 (Reconcile product_index.md: include both MOMENT_TIMELINE_REORDER_DESIGN.md and MOMENT_TIMELINE_PLAN.md)

## 참조
- 전체 문서 인덱스: `../doc_index.md`
- 대화 기록: `../conversation/`
