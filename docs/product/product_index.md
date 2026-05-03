# 제품 문서 인덱스

이 폴더에는 LoveBud 제품의 정의, 범위, 사용자 흐름, 정체성 등 **제품 관련 문서**가 저장됩니다.

## 용도
- 제품의 방향성과 범위 명시
- MVP 정의 및 사용자 여정
- 브랜드 정체성 및 디자인 원칙
- 팬페이지 기반 감성 UX / 페이지 경험 기준 정리
- 전역 UI 카피 운영 기준 정리
- public-first visibility / Plus private storage / anonymous public exposure / Browse/Search eligibility 정책 정리
- Browse sort semantics and public discovery language 정리

## 파일 목록

| 파일명 | 설명 |
|--------|------|
| [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md) | LoveBud의 핵심 정체성과 public-first 감상 공간 원칙 |
| [BRAND_EXPERIENCE.md](BRAND_EXPERIENCE.md) | 팬 경험 중심 브랜드/UX 톤앤매너와 페이지별 감성 기준 |
| [PUBLICATION_AND_PRIVACY_UX_POLICY.md](PUBLICATION_AND_PRIVACY_UX_POLICY.md) | public-first visibility, Plus private storage, memory visibility inheritance, anonymous public exposure, Browse/Search eligibility 정책 |
| [PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md](PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md) | public-by-default 정책과 private entitlement 이전 visibility mismatch를 안전하게 audit/backfill 판단하기 위한 count-only 계획 |
| [BROWSE_POPULAR_SORT_SEMANTICS.md](BROWSE_POPULAR_SORT_SEMANTICS.md) | Browse `popular` sort의 현재 memory-count proxy 의미와 v0.1 표시 정책 방향 |
| [TREE_MOMENT_SOCIAL_MODEL.md](TREE_MOMENT_SOCIAL_MODEL.md) | public LoveTree의 tree-level / moment-level comments, reactions, permissions, moderation, phased implementation 모델 |
| [TREE_LEVEL_COMMENTS_READ_CONTRACT.md](TREE_LEVEL_COMMENTS_READ_CONTRACT.md) | public LoveTree 전체에 붙는 tree-level comments의 read contract, visibility guard, safe response, empty/error state 기준 |
| [MOMENT_LEVEL_COMMENTS_READ_CONTRACT.md](MOMENT_LEVEL_COMMENTS_READ_CONTRACT.md) | public LoveTree 특정 순간에 붙는 moment-level comments의 parent tree / target moment read guard, safe response, empty/error state 기준 |
| [V01_CTA_EXPOSURE_POLICY.md](V01_CTA_EXPOSURE_POLICY.md) | v0.1 unfinished/partial action 노출 기준과 Ready/Soft/Disabled/Hidden CTA 분류 정책 |
| [MOMENT_TIMELINE_PLAN.md](MOMENT_TIMELINE_PLAN.md) | cue-based YouTube Moment Timeline 제품/기술 계획 |
| [YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md](YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md) | cue-based YouTube segment player PoC scope and Go/No-Go criteria |
| [YOUTUBE_SEGMENT_PLAYER_POC_TEST_MATRIX.md](YOUTUBE_SEGMENT_PLAYER_POC_TEST_MATRIX.md) | YouTube segment player PoC test matrix and browser verification requirements |
| [YOUTUBE_SEGMENT_PLAYER_POC_RUNTIME_NOTES.md](YOUTUBE_SEGMENT_PLAYER_POC_RUNTIME_NOTES.md) | Runtime observations and limitations from PoC implementation |
| [YOUTUBE_SEGMENT_PLAYER_POC_BROWSER_VERIFICATION.md](YOUTUBE_SEGMENT_PLAYER_POC_BROWSER_VERIFICATION.md) | Browser verification evidence and feasibility decision for the YouTube segment player PoC |
| [MOMENT_CAPTURE_UI_DESIGN.md](MOMENT_CAPTURE_UI_DESIGN.md) | Moment capture UI flow design |
| [MOMENT_TIMELINE_REORDER_DESIGN.md](MOMENT_TIMELINE_REORDER_DESIGN.md) | Moment Timeline reorder / sequence editor design |
| [UI_COPY_DIET_GUIDE.md](UI_COPY_DIET_GUIDE.md) | 전역 UI 카피 다이어트 기준 |
| [MVP_SCOPE.md](MVP_SCOPE.md) | MVP 범위 및 포함/제외 항목 |
| [USER_FLOW.md](USER_FLOW.md) | 주요 사용자 여정 및 핵심 플로우 |
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
- Browse `popular` sort는 현재 true engagement popularity가 아니라 `publicMemoryCount DESC, createdAt DESC` proxy입니다.
- private tree 아래 public memory가 가능하더라도 Browse/Search, community memories list, public memory detail read 노출은 parent tree visibility guard를 함께 봅니다.
- owner/private read는 private access policy에 따라 private tree 아래 public/private memory를 조회할 수 있습니다.

## Social model highlights

public LoveTree social surfaces are planned as two distinct scopes:

- tree-level discussion/reactions for the full public LoveTree;
- moment-level discussion/reactions for a specific public moment/node.

The two scopes should not be merged into one ambiguous count or comment surface. Public reads must inherit parent tree and target moment visibility boundaries.

## Tree-level comments read highlights

Tree-level comments belong to the whole public LoveTree, not to a selected moment. Public reads require the parent tree to be publicly readable and must exclude hidden, deleted, or moderated comments from public response shapes.

## Moment-level comments read highlights

Moment-level comments belong to one selected public moment. Public reads require both the parent tree and the target moment to be publicly readable and must exclude hidden, deleted, or moderated comments from public response shapes.

## CTA readiness highlights

v0.1 action exposure uses four readiness classifications:

- Ready;
- Soft exposure;
- Disabled with explanation;
- Hidden / deferred.

Strong primary CTAs require Ready status and valid runtime verification when Auth/API/data-loaded behavior is involved.

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
4. **PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md** — public-by-default 정책 alignment와 private entitlement 이전 visibility mismatch audit/backfill gate
5. **BROWSE_POPULAR_SORT_SEMANTICS.md** — Browse `popular` sort의 현재 의미와 v0.1 표시 정책 방향
6. **TREE_MOMENT_SOCIAL_MODEL.md** — tree-level / moment-level social scope, permissions, moderation, data model planning
7. **TREE_LEVEL_COMMENTS_READ_CONTRACT.md** — tree-level comments read scope, parent-tree guard, public-safe response, empty/error state contract
8. **MOMENT_LEVEL_COMMENTS_READ_CONTRACT.md** — moment-level comments read scope, parent-tree guard, target-moment guard, public-safe response, empty/error state contract
9. **V01_CTA_EXPOSURE_POLICY.md** — v0.1 unfinished/partial action 노출 기준과 CTA readiness 분류 정책
10.  **MOMENT_TIMELINE_PLAN.md** — cue-based Moment Timeline 계획
11.  **YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md** — YouTube segment player PoC scope and verification criteria
12.  **YOUTUBE_SEGMENT_PLAYER_POC_TEST_MATRIX.md** — YouTube segment player PoC test matrix and browser verification requirements
13.  **YOUTUBE_SEGMENT_PLAYER_POC_RUNTIME_NOTES.md** — YouTube segment player PoC runtime observations and limitations
14.  **YOUTUBE_SEGMENT_PLAYER_POC_BROWSER_VERIFICATION.md** — YouTube segment player PoC browser verification evidence and feasibility decision
15.  **MOMENT_CAPTURE_UI_DESIGN.md** — Moment capture UI flow 설계
16. **MOMENT_TIMELINE_REORDER_DESIGN.md** — Moment Timeline reorder / sequence editor 설계
17. **UI_COPY_DIET_GUIDE.md** — 전역 UI 카피 다이어트 기준
18. **MVP_SCOPE.md** — MVP 범위 및 In/Out of Scope
19. **USER_FLOW.md** — 사용자 여정 및 핵심 플로우
20. **PRODUCT_BRIEF.md** — 현재 실행 기준 요약
21. 필요시 DATA_NAMING_RULE.md, READONLY_SHARE_SCOPE.md

## 참조
- 전체 문서 인덱스: `../doc_index.md`
- 대화 기록: `../conversation/`
