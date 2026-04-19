# LoveTree API Contract Migration

## 현재 정식 계약
- flat camelCase

## 현재 이행기 호환
- legacy `{ data }` wrapper
- `tree_id` → `treeId`
- `created_at` → `createdAt`
- `owner_id` → `ownerId`
- `emotion_tags` → `emotionTags`

## fallback 제거 조건
1. `/api/community/trees`가 camelCase-only 응답으로 고정
2. `/api/community/memories`가 camelCase-only 응답으로 고固定
3. mock browse 경로도 camelCase-only로 정리
4. 계약 테스트가 camelCase 기준으로 고정

## 제거 순서
1. 서버 응답 계약 확정
2. 계약 테스트 갱신
3. adapter fallback 제거
4. transitional helper 테스트 축소 또는 삭제
