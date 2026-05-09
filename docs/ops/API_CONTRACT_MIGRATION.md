# LoveTree API Contract Migration

## 현재 정식 계약
- flat camelCase

## 현재 이행기 호환
- legacy `{ data }` wrapper
- `tree_id`
- `created_at`
- `owner_id`
- `emotion_tags`

## 적용 범위
- 현재 이행기 호환은 public browse adapter 경로에 한정합니다.
- 새 UI 코드와 새 데이터 처리 코드는 snake_case를 직접 읽지 않습니다.
- legacy 필드 접근은 `js/api/public-tree-adapter.js` 내부에만 남깁니다.

---

## browse contract migration split

### 1) Browse Summary Contract (현재 정식 운영 경로)

**endpoint**
- `GET /api/community/trees?view=summary&sort=latest&limit=3`

**query params**
- `view=summary`
- `sort=latest`
- `limit=3`

**response shape**
- browse 카드 렌더용 summary list
- 메모리 전체 배열은 포함하지 않음
- 포함 필드
  - `id`
  - `title`
  - `visibility`
  - `createdAt`
  - `updatedAt`
  - `representativeThumbnail`
  - `memoryCount`
  - `emotionTags`
  - `stage`
  - `theme`
  - `timeRange`

**fallback rules**
- summary는 first paint용 계약이므로, preview 렌더에 필요한 full memories를 포함하지 않음
- `representativeThumbnail`이 비면 클라이언트 카드 fallback 사용
- `theme`, `stage`, `timeRange`는 비어 있어도 browse 렌더가 깨지지 않아야 함

**backward compatibility rule**
- 정식 서버 계약은 camelCase
- browse adapter 내부에서만
  - `{data}` wrapper
  - `created_at`
  - `updated_at`
  - `owner_id`
  - `representative_thumbnail`
  - `memory_count`
  를 이행기 fallback으로 허용

### 2) Preview Hydration Contract (현재 정식 운영 경로)

**endpoint**
- `GET /api/community/memories?treeId=<treeId>`

**query params**
- `treeId=<treeId>`
- optional `limit` (현재 browse 호출에서는 생략)

**response shape**
- public memory list only
- tree summary 응답과 합쳐서 preview용 hydrated tree model을 만듦

**fallback rules**
- hydrate 실패 시 browse list는 유지
- preview만 reset 가능
- summary 모델은 fallback source로 유지
- adapter가 memory 단위 이행기 snake_case / `{data}` wrapper를 임시 흡수

**backward compatibility rule**
- snapshot 도입 전까지 현재 browse preview hydrate의 정식 기준은 `/community/memories?treeId=` 경로
- camelCase-only가 고정되기 전까지 adapter fallback 유지

### 3) Future Modal Snapshot Contract (예정 계약)

**상태**
- 아직 구현 전
- 현재 문서상 migration target만 정의

**목적**
- summary list와 preview hydrate 계약을 유지하면서
- Modal open용 최소 snapshot 응답을 별도 계약으로 고정
- full memory list fetch를 Modal 기본 계약으로 강제하지 않음

**예정 endpoint 방향**
- `GET /api/community/trees/<treeId>/snapshot`
  또는
- `GET /api/community/trees?view=snapshot&treeId=<treeId>`

**예정 response shape 방향**
- summary 필드 재사용
- 추가 최소 필드만 확장
  - `previewMemory`
  - `flowPreview`
  - 필요 시 modal description / representative memo

**migration direction**
1. summary contract 고정
2. preview hydration contract 고정
3. snapshot response shape를 별도 스냅샷 테스트로 고정
4. Modal에서 snapshot 우선 사용
5. 기존 `/community/memories?treeId=`는 초기에는 fallback 유지
6. snapshot 안정화 후 hydrate 경로 축소 여부 재판단

**backward compatibility rule**
- snapshot 도입 전까지 summary + hydrate 조합은 유지
- snapshot 도입 직후에도 browse adapter는 기존 hydrate 경로를 fallback으로 유지
- snapshot이 테스트와 문서 기준으로 고정되기 전에는 기존 hydrate 경로 제거 금지

### 4) HOT / 추천 / 좋아요 확장 migration split (예정 계약)

#### 4-1) Summary에 바로 붙일 수 있는 최소 additive fields

**summary additive field 후보**
- `badgeLabel?: 'HOT' | '추천' | null`
- `hotScore?: number | null`
- `likeCount?: number | null`
- `bookmarkCount?: number | null`
- `reactionCount?: number | null`

**지금 바로 필요한 필드**
- `badgeLabel`
- `hotScore`
- `likeCount`

**후순위 필드**
- `bookmarkCount`
- `reactionCount`

**rule**
- summary에는 카드 정렬, 배지, 작은 수치 노출에 직접 필요한 aggregate만 허용
- 개인화/설명형 필드는 금지

#### 4-2) HOT ranking 필드

**ranking field 후보**
- `hotScore`
- `recentViewCount7d`
- `recentLikeCount7d`
- `recentBookmarkCount7d`
- `trendingWindow`

**지금 바로 필요한 필드**
- `hotScore`

**후순위 필드**
- `recentViewCount7d`
- `recentLikeCount7d`
- `recentBookmarkCount7d`
- `trendingWindow`

**rule**
- summary에는 `hotScore`까지만 허용 가능
- 세부 ranking 근거 수치는 snapshot 또는 별도 ranking endpoint로 분리

#### 4-3) 추천 필드

**추천 field 후보**
- `recommendationKey`
- `recommendationReasonCode`
- `recommendationScore`

**지금 바로 필요한 필드**
- 없음

**후순위 필드**
- `recommendationReasonCode`
- `recommendationScore`
- `recommendationKey`

**rule**
- 추천은 summary 기본 계약보다 query/endpoint 축으로 분리
- 추천 이유는 summary에 넣지 않고 snapshot 또는 recommendation endpoint로 이동

#### 4-4) 좋아요 / 북마크 / 반응 필드

**aggregate field 후보**
- `likeCount`
- `bookmarkCount`
- `reactionCount`

**user-state field 후보**
- `likedByMe`
- `bookmarkedByMe`
- `reactedByMe`

**지금 바로 필요한 필드**
- aggregate: `likeCount`

**후순위 필드**
- aggregate: `bookmarkCount`, `reactionCount`
- user-state: `likedByMe`, `bookmarkedByMe`, `reactedByMe`

**rule**
- aggregate는 summary additive field 허용 가능
- user-state는 summary 금지, snapshot 또는 viewer-state endpoint로만 허용

#### 4-5) Snapshot 전용 필드

**snapshot 전용 후보**
- `recommendedReasonText`
- `socialProofText`
- `reactionBreakdown`
- `likedByMe`
- `bookmarkedByMe`

**rule**
- 추천 이유 설명, 반응 분해, 개인화 상태는 snapshot 전용
- browse first paint summary에는 올리지 않음

#### 4-6) 별도 endpoint 방향

**ranking / recommendation query 방향**
- `GET /api/community/trees?view=summary&sort=hot`
- `GET /api/community/trees?view=summary&sort=recommended`

**user-state 방향**
- `GET /api/community/trees/<treeId>/viewer-state`
- 또는 snapshot 응답에 인증 사용자 상태 조건부 포함

**reaction write 방향**
- `POST /api/community/trees/<treeId>/like`
- `POST /api/community/trees/<treeId>/bookmark`
- `POST /api/community/trees/<treeId>/reactions`

#### 4-7) backward compatibility rule

- 기존 summary 필드는 유지
- HOT / 추천 / 반응 필드는 additive optional field만 허용
- browse adapter와 기존 browse renderer는 새 필드가 없어도 그대로 동작해야 함
- detail 계약에 HOT / 추천 / user-state 필드를 강제로 밀어 넣지 않음

#### 4-8) rollout direction

**Phase 1**
- summary additive fields
  - `badgeLabel`
  - `hotScore`
  - `likeCount`

**Phase 2**
- query 확장
  - `sort=hot`
  - `sort=recommended`

**Phase 3**
- snapshot 확장
  - `recommendedReasonText`
  - `socialProofText`
  - `likedByMe`
  - `bookmarkedByMe`

**Phase 4**
- viewer-state / reaction write endpoint

---

## fallback 제거 조건
1. `/api/community/trees`가 camelCase-only 응답으로 고정
2. `/api/community/memories`가 camelCase-only 응답으로 고정
3. mock browse 경로도 camelCase-only로 정리
4. 계약 테스트가 camelCase 기준으로 green 유지
5. Modal snapshot 도입 시 snapshot contract 테스트가 별도로 green 유지
6. HOT / 추천 / 반응 필드가 additive optional shape로 테스트 고정

## 제거 순서
1. 서버 응답 계약 확정
2. 계약 테스트 갱신
3. adapter fallback 제거
4. transitional helper 테스트 축소 또는 삭제
5. snapshot 도입 후 summary / hydrate / snapshot 경계 재점검
6. reaction / recommendation user-state를 summary 바깥으로 고정

## 제거 대상
- `{ data }` wrapper
- `tree_id`
- `created_at`
- `owner_id`
- `emotion_tags`
- browse adapter 내부의 snake_case field fallback

## 주의사항
- browse Modal에 detail/tree payload 계약을 그대로 재사용하지 않음
- summary 응답에 memories 전체를 다시 넣지 않음
- snapshot 도입 전까지 현재 browse 구현의 first paint 성능 특성을 깨지 않음
- HOT / 추천 / user-state를 한 번에 summary에 넣지 않음
- `likedByMe` 같은 개인화 필드는 인증 없는 browse summary 기본 계약에 넣지 않음
