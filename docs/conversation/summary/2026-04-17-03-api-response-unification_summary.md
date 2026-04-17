# 2026-04-17-03-api-response-unification

## 핵심 주제
1-2차 API 응답 통일 작업 - 백엔드 flat camelCase 응답으로 표준화, 프론트 호환성 유지

## 확정 판단
- `_lib/serializers.js` 추가하여 내부 `{id, data: {...}}` 구조를 flat camelCase API shape로 변환
- `memory-detail.js` GET: public memory 비로그인 허용, PATCH/PUT/DELETE는 owner only 유지
- `memories.js`, `trees.js`, `tree-detail.js`에 serializers 적용하여 일관된 응답 반환
- `search.js`의 잘못된 tree.data flatten 로직 제거 → `apiClient.getPublicTrees()` 결과 직접 사용
- `detail.js`/`editor.js`의 `normalizeMemory`는 호환성 유지를 위해 임시 shim으로 축소, 이후 제거

## 완료 작업
- [x] `docs/conversation/2026-04-17_18-57-21__Lovebud__chat.md` → `full/2026-04-17-03-api-response-unification.md` 이동
- [x] 요약 본문 작성
- [ ] `full_index.md` 업데이트
- [ ] `summary_index.md` 업데이트

## 중요 커밋
`c7013dd`: fix: search.js 버그 수정 및 editor.js root 안정화

## 남은 blocker
- `memory-detail.js` GET: 여전히 `requireUser()`로 public access 차단됨 (수정 필요)
- `memories.js`, `trees.js`, `tree-detail.js` 아직旧 `{id, data}` 응답 구조 사용 중
- 실제 백엔드 코드에 1-2차 변경사항 반영 필요 (models에게 코드 전달 필요)

## 다음 액션
- 모델에게 1-2차 코드 패치 전체 전달 (`memory-detail.js`, `memories.js`, `trees.js`, `tree-detail.js`, `search.js`)
- 반영 후 browse/detail/editor/create/update/delete 전체 흐름 검증
- 검증 후 프론트 `normalizeMemory` 제거 검토
