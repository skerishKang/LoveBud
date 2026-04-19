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

## fallback 제거 조건
1. `/api/community/trees`가 camelCase-only 응답으로 고정
2. `/api/community/memories`가 camelCase-only 응답으로 고정
3. mock browse 경로도 camelCase-only로 정리
4. 계약 테스트가 camelCase 기준으로 green 유지

## 제거 순서
1. 서버 응답 계약 확정
2. 계약 테스트 갱신
3. adapter fallback 제거
4. transitional helper 테스트 축소 또는 삭제

## 제거 대상
- `{ data }` wrapper
- `tree_id`
- `created_at`
- `owner_id`
- `emotion_tags`
