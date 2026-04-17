# detail (기억 상세)

## 페이지 목적
특정 메모리(기억)의 상세 정보를 보고, 같은 트리의 다른 기억들과의 연결을 확인하는 페이지.

## 사용자 목표
1. 선택한 메모리의 영상/详细内容 확인
2. 감정 메모 및 태그 확인
3. 이 기억의 위치 (트리의哪儿) 확인
4. 같은 트리의 다른 기억들 탐색
5. editor로 돌아가 편집하거나, 다른 트리로 이동

---

## 현재 구현 상태

### 주요 UI 섹션
- **Video Area**: 16:9 비디오/썸네일 영역
- **Action Bar**: 공유, 저장 등 액션 버튼
- **Memory Info**: 제목, 날짜, 감정 태그, 감정 메모
- **Connected Section**: 같은 트리의 다른 기억들 (Moment Cards)

### 현재 파일 구조
- `pages/detail.html` (265줄)
- CSS: `global.css` 공통
- JS: 인라인 또는 별도 (파일 확인 필요)

### 주요 기능
- URL 파라미터로 treeId, memoryId 수신
- 비디오 (YouTube 임베드) 또는 썸네일 표시
- 감정 메모 렌더링
- 같은 tree의 다른 memories 나열
-editor로의 링크 (from=detail 파라미터)

---

## 현재 잘 되는 것

| 항목 | 상태 |
|------|------|
| 비디오 영역 | ✅ 16:9 aspect-ratio, rounded corners |
| 메모리 정보 표시 | ✅ 제목, 날짜, 태그, 메모 |
| 같은 트리 연결 표시 | ✅ Moment Cards (연결된 기억들) |
|editor 링크 | ✅ "편집하기" 버튼으로editor 이동 |
| null 에러 방지 | ✅ null/undefined 체크 |

---

## 현재 문제/리스크

| 문제 | 설명 |
|------|------|
| null/undefined 처리 | 메모리가 null이면 에러 발생 → 방어적 처리 필요 |
| video 임베드 | YouTube iframe vs 썸네일만 표시 |
| 상세 페이지 에러 시 | 사용자에게 명확한 에러 UI 필요한 상황 |
| 로그인 없으면 | 타인의 public tree만view 가능, private 접근 시 ?

---

## 상태별 화면

### 1. 정상 (메모리 있음)
- 비디오 또는 썸네일Large 표시
- 메모 정보 (제목, 날짜, 태그, 메모)
- "연결된 순간들" - 같은 트리의 다른 메모리卡片
- 하단: 트리 편집 링크, 둘러보기 링크

### 2. 메모리를 찾을 수 없음 (null)
- "기억을 찾지 못했어요" 제목
- "요청하신 기억이 존재하지 않거나 접근할 수 없는 상태입니다."
- "첫화면으로", "러브트리 둘러보기" 버튼
- i18n 키: `memory_not_found_title`, `memory_not_found_desc`

### 3. 에러 발생
- console.error로 로깅
- 사용자 화면에는 명확한 에러 메시지 없음 → 개선 필요

---

## 필요한 데이터/API

| 데이터 | 소스 | 비고 |
|--------|------|------|
| tree data | `apiClient.getTree(treeId)` | |
| memory detail | payload.nodes에서 memoryId 찾기 | |
| connected memories | 같은 tree의 다른 nodes | parent-child 관계 표시 |

---

## 다음 개선 포인트

1. null/undefined 시 에러 UI 명확화
2. 비디오 실제 재생 (YouTube iframe)
3. 감상 모드 (영상 자동 재생, 노트)
4. 타 트리 이동 (연결된 트리 탐색)
5. 공유하기 기능 실제 구현