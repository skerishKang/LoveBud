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
- Editor/viewer vertical LoveTree layout decision 정리

## 파일 목록

| 파일명 | 설명 |
|--------|------|
| [PRODUCT_IDENTITY.md](PRODUCT_IDENTITY.md) | LoveBud의 핵심 정체성과 public-first 감상 공간 원칙 |
| [BRAND_EXPERIENCE.md](BRAND_EXPERIENCE.md) | 팬 경험 중심 브랜드/UX 톤앤매너와 페이지별 감성 기준 |
| [PUBLICATION_AND_PRIVACY_UX_POLICY.md](PUBLICATION_AND_PRIVACY_UX_POLICY.md) | SOURCE_OF_TRUTH: public-first visibility, Plus private storage, memory visibility inheritance, anonymous public exposure, and Browse/Search eligibility 정책 |
| [PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md](PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md) | public-by-default 정책과 private entitlement 이전 visibility mismatch를 안전하게 audit/backfill 판단하기 위한 count-only 계획 |
| [BROWSE_POPULAR_SORT_SEMANTICS.md](BROWSE_POPULAR_SORT_SEMANTICS.md) | Browse `popular` sort의 현재 memory-count proxy 의미와 v0.1 표시 정책 방향 |
| [lovebud-browse-tree-social-counts-plan.md](lovebud-browse-tree-social-counts-plan.md) | #1661 tree-level Browse social counts foundation plan — storage model, likes-before-views order, duplicate view policy, and follow-up split |
| [lovebud-browse-tree-view-count-policy.md](lovebud-browse-tree-view-count-policy.md) | #1661 Unit B tree-level view count policy — countable event boundary, duplicate suppression, privacy-safe actor key, and sort/UI hold |
| [lovebud-browse-sort-views-readiness-audit.md](lovebud-browse-sort-views-readiness-audit.md) | #1661 Unit C sort=views readiness audit — confirms backend prerequisites for `sort=views` runtime implementation |
| [lovebud-public-tree-detail-viewcount-read-boundary.md](lovebud-public-tree-detail-viewcount-read-boundary.md) | #1661 Unit B-read public tree detail `viewCount` read exposure boundary — narrow endpoint decision |
| [lovebud-browse-final-social-sort-labels-decision.md](lovebud-browse-final-social-sort-labels-decision.md) | #1661 Unit D final Browse social sort labels decision — `최신순` / `조회순` / `좋아요순`, `인기순` disposition |
| [lovebud-browse-tree-social-counts-completion-audit.md](lovebud-browse-tree-social-counts-completion-audit.md) | #2451 closure audit for #1661 — final tree-level social counts completion gate, Browse/Search sort/UI/payload boundaries, and closure recommendation |
| [READ_ONLY_LOVETREE_VIEWER_PLAN.md](READ_ONLY_LOVETREE_VIEWER_PLAN.md) | read-only LoveTree viewer의 route, public-safe data, viewer/editor separation, interaction, privacy guardrail 계획 |
| [lovebud-relationship-hints-review-before-save-plan.md](lovebud-relationship-hints-review-before-save-plan.md) | #2454 editor/canvas relationship hints review-before-save boundary — manual editing source of truth, suggested vs saved links, accept/dismiss, no hidden edges, no Scout/live work |
| [lovebud-relationship-hints-ux-prototype-plan.md](lovebud-relationship-hints-ux-prototype-plan.md) | #2456 editor/canvas relationship hints UX prototype plan — non-saving prototype, suggested-link visual language, future accept/dismiss placement, no-runtime boundary |
| [lovebud-relationship-hints-state-machine-contract.md](lovebud-relationship-hints-state-machine-contract.md) | #2458 editor/canvas relationship hints state machine contract — exact states, allowed/forbidden transitions, non-saved suggestion states, explicit save/confirm boundary |
| [VERTICAL_TREE_LAYOUT_DECISION.md](VERTICAL_TREE_LAYOUT_DECISION.md) | Editor와 read-only viewer의 세로형 tree-growth layout 채택 결정, desktop/mobile 원칙, phased rollout 기준 |
| [BROWSE_TREE_FIRST_DISCOVERY_PLAN.md](BROWSE_TREE_FIRST_DISCOVERY_PLAN.md) | Browse를 tree-first public LoveTree discovery로 발전시키기 위한 card/감상허브/viewer route semantics 계획 |
| [PUBLIC_VIEWER_SOCIAL_PLACEHOLDER_PLAN.md](PUBLIC_VIEWER_SOCIAL_PLACEHOLDER_PLAN.md) | public LoveTree viewer에서 tree-level / moment-level social placeholder 배치 방향, desktop/mobile placement, empty-state copy, write affordance 분리 기준 |
| [TREE_MOMENT_SOCIAL_MODEL.md](TREE_MOMENT_SOCIAL_MODEL.md) | public LoveTree의 tree-level / moment-level comments, reactions, permissions, moderation, phased implementation 모델 |
| [TREE_INSIGHTS_CONTRACT.md](TREE_INSIGHTS_CONTRACT.md) | Tree Insights owner-only page product/UX contract — 범위, 데이터 경계, 상호작용, 검증 기준 (#1046) |
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
| [SELECTED_MOMENT_REACTION_PLACEMENT_CONTRACT.md](SELECTED_MOMENT_REACTION_PLACEMENT_CONTRACT.md) | Editor detail panel selected moment reaction summary placement 및 data grammar 계약 (#1047) |
| [SHARED_TREE_SUMMARY_CONTRACT.md](SHARED_TREE_SUMMARY_CONTRACT.md) | Browse/My Trees/Editor/Public Viewer/Tree Insights 간 shared Tree Summary grammar 및 data boundary 계약 (#1048) |
| [VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md](VISIBILITY_AND_PRIVATE_STORAGE_POLICY_REVIEW.md) | HISTORICAL_AUDIT / SUPERSEDED_POLICY_REVIEW: former private-first state and staged public-first transition review; current authority is PUBLICATION_AND_PRIVACY_UX_POLICY.md |
| [tree-visibility-default-and-control-placement-decision.md](tree-visibility-default-and-control-placement-decision.md) | SUPERSEDED HISTORICAL_DECISION: former private-first visibility/control decision retained for provenance; must not guide current policy |
| [lovebud-editor-arrange-rethread-product-contract.md](lovebud-editor-arrange-rethread-product-contract.md) | #2471 editor canvas arrange/rethread product boundary — arrange는 visual-only saved edge 불변, rethread는 destructive preview/confirm 필수, UX policy, implementation gate |

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
- Browse `popular` sort 소개는 `publicMomentCount >= 3`이 필요합니다.
- Browse `popular` sort는 현재 true engagement popularity가 아니라 `publicMemoryCount DESC, createdAt DESC` proxy입니다.
- Browse tree-level social counts plan은 `조회순`/`좋아요순` 노출 전 storage model, likes-before-views order, duplicate view counting, and public payload policy를 먼저 요구합니다.
- Browse tree view count policy requires a bounded public tree view event source, 24h duplicate suppression, privacy-preserving actor/session keys, and continued `sort=views`/UI hold.
- private tree 아래 public memory가 가능하더라도 Browse/Search, community memories list, public memory detail read 노출은 parent tree visibility guard를 함께 봅니다.
- owner/private read는 private access policy에 따라 private tree 아래 public/private memory를 조회할 수 있습니다.
- #2451 completion audit confirms #1661 is ready to close completed: tree-level semantics, `sort=likes` / `sort=views`, final Browse labels, summary payload boundary, private/public boundary, and no raw analytics/Scout live work.

## Read-only viewer highlights

The read-only LoveTree viewer is the planned full-tree public viewing surface. It should use public-safe data, stay separate from Editor authority, and never create edit/delete/drag/add/title-edit/memo-edit/source-edit affordances in viewer mode.

## Vertical tree layout highlights

Editor and read-only viewer layout direction is vertical tree-growth, not a plain vertical list. The first/root moment should sit closer to the lower root area, while later connected moments grow upward through visible branches. Runtime implementation should proceed in phases and use screenshot-based review when visual quality is in scope.

## Relationship hints highlights

Relationship hints are optional review-before-save suggestions, not automatic hidden edges. Manual tree/canvas editing remains the source of truth; suggested links must be visually distinct from saved links; users must accept or dismiss hints explicitly; dismissed hints must not become saved relationships; and this planning slice includes no Scout/live AI/provider/fetch/network work. The #2456 UX prototype plan defines a non-saving prototype with dashed/dotted/provisional visual language, future accept/dismiss affordance placement, and no-runtime/no-live-provider boundaries. The #2458 state machine contract locks the exact hint states, allowed/forbidden transitions, non-saved suggestion states, and explicit save/confirm boundary.

## Arrange/rethread highlights

Arrange and rethread are two distinct families of editor moment-order controls. Arrange is visual-only canvas layout that must not mutate saved parent/child edges. Rethread modifies saved LoveTree flow/edge structure and requires preview and explicit confirmation. The #2471 product contract locks this boundary: arrange is safe and reversible, rethread is destructive and structural. No runtime arrange/rethread UI may be implemented without this contract. "날짜순으로 다시 잇기" requires preview-before-apply.

## Social model highlights

public LoveTree social surfaces are planned as two distinct scopes:

- tree-level discussion/reactions for the full public LoveTree;
- moment-level discussion/reactions for a specific public moment/node.

The two scopes should not be merged into one ambiguous count or comment surface. Public reads must inherit parent tree and target moment visibility boundaries.

## Viewer social placeholder highlights

public LoveTree viewer social placeholders follow a two-surface placement model:

- tree-level placeholder: below tree header/meta, above moment list, read-only empty state in Phase 1;
- moment-level placeholder: inside selected-moment detail panel, below moment content, read-only empty state in Phase 1.

Write affordance is deferred to Phase 3 and requires authenticated session. Private trees must not show any social placeholder.

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

1. **PRODUCT_IDENTITY.md** — 제품 철학과 핵심 가치
2. **BRAND_EXPERIENCE.md** — 팬 감성 UX / 톤앤매너 / 페이지별 표현 원칙
3. **PUBLICATION_AND_PRIVACY_UX_POLICY.md** — public-first visibility / Plus private storage / anonymous public exposure / Browse/Search eligibility 정책
4. **PUBLIC_DEFAULT_VISIBILITY_AUDIT_PLAN.md** — public-by-default 정책 alignment와 private entitlement 이전 visibility mismatch audit/backfill gate
5. **BROWSE_POPULAR_SORT_SEMANTICS.md** — Browse `popular` sort의 현재 의미와 v0.1 표시 정책 방향
6. **lovebud-browse-tree-social-counts-plan.md** — #1661 tree-level Browse social counts planning, storage model, likes-before-views order, duplicate view policy
7. **lovebud-browse-tree-view-count-policy.md** — #1661 Unit B tree-level view count policy, counted event boundary, duplicate suppression, privacy-safe keys, and sort/UI hold
8. **lovebud-browse-sort-views-readiness-audit.md** — #1661 Unit C sort=views readiness audit — confirms backend prerequisites for `sort=views` runtime implementation
9. **lovebud-public-tree-detail-viewcount-read-boundary.md** — #1661 Unit B-read public tree detail `viewCount` read exposure boundary — narrow endpoint decision
10. **lovebud-browse-final-social-sort-labels-decision.md** — #1661 Unit D final Browse social sort labels decision — `최신순` / `조회순` / `좋아요순`, `인기순` disposition
11. **lovebud-browse-tree-social-counts-completion-audit.md** — #2451 closure audit for #1661 — final tree-level social counts completion gate and closure recommendation
12. **READ_ONLY_LOVETREE_VIEWER_PLAN.md** — read-only LoveTree viewer route/data/viewer-editor separation 계획
13. **VERTICAL_TREE_LAYOUT_DECISION.md** — 세로형 tree-growth layout 채택 결정
14. **lovebud-relationship-hints-review-before-save-plan.md** — #2454 editor/canvas relationship hints review-before-save boundary
15. **lovebud-relationship-hints-ux-prototype-plan.md** — #2456 non-saving relationship hints UX prototype plan
16. **lovebud-relationship-hints-state-machine-contract.md** — #2458 relationship hints state machine contract
17. **lovebud-editor-arrange-rethread-product-contract.md** — #2471 editor canvas arrange/rethread product boundary — arrange vs rethread 정의, saved edge boundary, preview/confirm policy, implementation gate
18. **BROWSE_TREE_FIRST_DISCOVERY_PLAN.md** — Browse tree-first discovery와 viewer route semantics 계획
19. **PUBLIC_VIEWER_SOCIAL_PLACEHOLDER_PLAN.md** — public viewer social placeholder 배치 및 phasing 계획
20. **TREE_MOMENT_SOCIAL_MODEL.md** — tree-level / moment-level social scope, permissions, moderation, data model planning
21. **TREE_LEVEL_COMMENTS_READ_CONTRACT.md** — tree-level comments read scope, parent-tree guard, public-safe response, empty/error state contract
22. **MOMENT_LEVEL_COMMENTS_READ_CONTRACT.md** — moment-level comments read scope, parent-tree guard, target-moment guard, public-safe response, empty/error state contract
23. **V01_CTA_EXPOSURE_POLICY.md** — v0.1 unfinished/partial action 노출 기준과 CTA readiness 분류 정책
24. **MOMENT_TIMELINE_PLAN.md** — cue-based Moment Timeline 계획
25. **YOUTUBE_SEGMENT_PLAYER_POC_SCOPE.md** — YouTube segment player PoC scope and verification criteria
26. **YOUTUBE_SEGMENT_PLAYER_POC_TEST_MATRIX.md** — YouTube segment player PoC test matrix and browser verification requirements
27. **YOUTUBE_SEGMENT_PLAYER_POC_RUNTIME_NOTES.md** — YouTube segment player PoC runtime observations and limitations
28. **YOUTUBE_SEGMENT_PLAYER_POC_BROWSER_VERIFICATION.md** — YouTube segment player PoC browser verification evidence and feasibility decision
29. **MOMENT_CAPTURE_UI_DESIGN.md** — Moment capture UI flow 설계
30. **MOMENT_TIMELINE_REORDER_DESIGN.md** — Moment Timeline reorder / sequence editor 설계
31. **UI_COPY_DIET_GUIDE.md** — 전역 UI 카피 다이어트 기준
32. **MVP_SCOPE.md** — MVP 범위 및 In/Out of Scope
33. **USER_FLOW.md** — 사용자 여정 및 핵심 플로우
34. **PRODUCT_BRIEF.md** — 현재 실행 기준 요약
35. **필요시 DATA_NAMING_RULE.md, READONLY_SHARE_SCOPE.md**

## 참조
- 전체 문서 인덱스: `../doc_index.md`
- 대화 기록: `../conversation/`