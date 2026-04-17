# editor (러브트리 편집)

## 페이지 목적
사용자가 선택한 트리의 순간들을 시각적으로 보고, 새 순간을 추가하거나 선택한 순간을 확인하는 핵심 작업 공간.

## 사용자 목표
1. 트리의 전체 구조 시각화 (트리 뷰)
2. 새 순간 추가 (YouTube URL → 제목 → 감정 메모)
3. 기존 순간 선택 및 상세 보기
4. 순간 간 감정 경로 확인

> 용어 기준:
> - UI/기획 용어: **순간**
> - 내부 구현 용어: **node**, **memory**
> - 현재 editor는 "트리 안의 한 순간"을 노드 형태로 보여주고, 내부적으로 memory 데이터를 다룹니다.

---

## 현재 구현 상태 (2026-04-18 기준)

### 모듈 구조 (최소 리팩터링 적용)
| 파일 | 책임 | 비고 |
|------|------|------|
| `js/editor.js` | 메인 오케스트레이션 | 979줄 → Root helpers 분리 |
| `js/editor/editor-root-helpers.js` | Root memory 식별/관리 | 순수 함수, 재사용 가능 |
| `js/utils/ui.js` | Toast/Loading/Confirm | 공통 유틸, editor.js에서 사용 |
| `js/utils/normalize.js` | Memory/Tree 정규화 | 공통 유틸, editor.js에서 사용 |

### 최근 수정사항 (Codex + Kimi 협업)
| 날짜 | 수정사항 | 파일 |
|------|----------|------|
| 2026-04-18 | **editor.js 구조 리팩터링** | editor.js, editor-root-helpers.js |
| 2026-04-18 | 인증 콜백 배열화 (`window.onAuthReady` → `registerOnAuthReady`) | auth.js, my-trees.js, editor.js |
| 2026-04-18 | editor.js 인증 패턴 단순화 (my-trees.js와 통일) | editor.js |
| 2026-04-18 | 에디터 저장 PUT 핸들러 추가 (memory-detail.js) | memory-detail.js |
| 2026-04-18 | deleteMemory row 스코프 버그 + JSONB 최적화 | doc-store.js |
| 2026-04-18 | 데이터 평탄화: detail.js, search.js | detail.js, search.js |
| 2026-04-18 | root 모델 안정화 (findRootMemory 개선, parentId null 금지) | editor.js |
| 2026-04-18 | search.js basePath 버그 + categorize() 구현 | search.js |
| 2026-04-18 | editor.html에 cache-utils.js 추가 | editor.html |

### 주요 기술적 개선
- **인증 시스템**: 여러 페이지 동시 인증 콜백 가능, 로그인/로그아웃 안정성 향상
- **API 계약**: editor 저장/삭제 기능 서버 응답과 일치 (PUT 200, DELETE 200)
- **데이터 모델**: API 응답 `{id, data:{...}}` → 평탄화 `{id, title, ...}` 변환
- **트리 구조**: root 노드 식별 안정화 (createdAt 기준 oldest 선택), parentId null 자식 제거
- **캐시**: editor 페이지에 LoveBudCache 통합, 빠른 첫 로드

---

## 현재 잘 되는 것

| 항목 | 상태 |
|------|------|
| 트리 노드 렌더링 | ✅ SVG circle + label |
| 브랜시 그리기 | ✅ 부모-자식 연결 선 |
| 순간 추가 폼 | ✅ YouTube URL 파싱, 폼 제출 |
| 상세 패널 | ✅ 선택 노드 정보 표시 |
| 순간 수정 | ✅ 상세 패널에서 편집 (제목, 메모, 태그) |
| 순간 삭제 | ✅ 확인 후 삭제, 트리/패널 갱신 |
| auth 가드 | ✅ 비로그인 시 login redirect |
| Firebase 준비 대기 | ✅ API 호출 전 Firebase_ready 체크 |
| null fallback | ✅ createdMemory null 시 방어적 처리 |
| 로컬 폴백 | ✅ API 실패 시 로컬에 메모리 저장 |
| 로컬 저장 표시 | ✅ 토스트 메시지 + 상세 패널 배지 |

---

## 현재 문제/리스크

| 문제 | 설명 |
|------|------|
| 첫 노드 위치 | 첫 번째 노드가 화면 위로 벗어남 → ROOT_Y 조정으로 최소 수정 |
| parentId format | 첫 메모리 추가 시 "Invalid parentId format" → null 전송으로 해결 |
| 로컬 저장 awareness | API 실패 시 사용자가 로컬에만 저장된 줄 모름 → 최근 개선됨 (토스트 + 배지) |
| 미리보기 버튼 | "준비중" 표시, 실제 기능 아님 |
| 더 많은 버튼 | 화면에 있으나 숨김 처리 (준비중) |
| Firebase unavailable | Firebase SDK 로드 실패 시 에러 토스트 표시 |

---

## 상태별 화면

### 1. 초기 로드
- Shared Header 렌더링 대기
- Firebase 준비 확인
- 트리 데이터 로드 (URL param treeId 또는 getFirstTree fallback)

### 2. 트리 있음 (성공)
- SVG 캔버스에 노드 렌더링
- 사이드바: "트리 보기/편집" 활성 상태
- 노드 클릭 시 상세 패널 업데이트
- 노드 더블클릭 시 상세 페이지로 이동

### 3. 빈 트리 (순간 없음)
- 캔버스에 루트 노드만 표시
- "아직 등록된 기억이 없습니다" 메시지
- "영상 추가" 버튼으로 새 순간 추가 가능

### 4. 순간 추가 중
- 폼 모달 표시 (중앙 배치)
- YouTube URL 입력 → 자동 썸네일 시도
- 제목, 메모 입력
- "추가하기" 버튼 → API 호출 → 성공 시 토스트 + 캔버스 업데이트

### 5. 순간 수정/삭제
- 상세 패널이 기본 진입점
- 읽기 모드에서 `순간 수정`, `순간 삭제` 버튼 노출
- `순간 수정` 클릭 시 같은 상세 패널에서 편집 모드로 전환 (제목, 메모, 감정 태그 편집)
- `순간 삭제` 클릭 시 확인 대화상자 후 삭제
- 삭제 후 자동으로 root 또는 다음 순간 선택, 트리/패널 갱신
- API 실패 시 토스트 메시지로 사용자 알림
- 우클릭/더보기 메뉴는 추후 확장으로 보류

### 6. 로컬 폴백 (API 실패)
- 주황색 토스트: "기억이 저장되었습니다 (로컬만)"
- 상세 패널 헤더에 "로컬 저장" 배지 표시

### 7. 에러
- Firebase 초기화 실패: "Firebase 준비 실패" 토스트
- 메모리 추가 실패: "기록 저장 중 오류가 발생했습니다" 토스트

---

## 필요한 데이터/API

| 데이터 | 소스 | 비고 |
|--------|------|------|
| tree data | `apiClient.getTree(treeId)` | payload.nodes 포함 |
| memories | `apiClient.getMemoriesByTree(treeId)` 또는 payload.nodes | |
| create memory | `apiClient.createMemory(memoryData)` | |
| first tree | `apiClient.getFirstTree()` | treeId 없을 때 fallback |

---

## 에디터 구조 및 확장 포인트

### 현재 아키텍처 (2026-04-18 리팩터링 후)

```
js/editor.js (메인 오케스트레이션)
├── 초기화: 트리 로드, 캐시 설정, 인증 가드
├── 상태 관리: selectedNodeId, isLocalSaveMode, currentEditingMemory
├── 캔버스 렌더링: initCanvas, drawRoot, drawBranch, drawNode
├── 상세 패널: updateDetailPanel, enterEditMode, exitEditMode
├── 메모리 조작: saveMemoryEdit, deleteMemory, addMemoryFromForm
├── 이벤트 바인딩: 버튼 클릭, 키보드, 폼 제출
└── 위치 계산: calcPosition (트리 레이아웃 알고리즘)

js/editor/editor-root-helpers.js (분리됨)
├── findRootMemory: parentId === null 기반 root 식별
├── getRootId: root ID 반환
├── getCanonicalRootId: canonical root 계산
└── isRootMemory: root 여부 확인

js/utils/* (공통 유틸)
├── ui.js: Toast, Loading, Confirm
├── normalize.js: Memory/Tree 정규화
├── path.js: 경로 처리 (시범 적용)
└── media.js: YouTube 처리 (2026-04-18 editor.js 연결 완료)
```

### 확장 가능한 지점

| 영역 | 현재 | 확장 방향 |
|------|------|-----------|
| **Root Helpers** | 분리 완료 | 다른 트리 뷰 페이지에서 재사용 가능 |
| **캔버스 렌더링** | editor.js 내장 | `editor-canvas.js` 분리 고려 (드래그 기능 추가 시) |
| **상세 패널** | editor.js 내장 | `editor-panel.js` 분리 고려 (모달/팝오버 지원 시) |
| **메모리 Form** | editor.js 내장 | `editor-form.js` 분리 고려 (복잡한 폼 검증 시) |
| **미디어 처리** | ✅ media.js 연결 완료 | `detail.js`, `search.js`에도 확대 적용 검토 |

### 다음 개선 포인트

1. **노드 드래그/편집 기능** - 캔버스 렌더링 모듈 분리 필요
2. **브랜치 연결 편집** (parent 변경) - calcPosition 알고리즘 수정
3. **미리보기 기능** 실제 구현 - media.js 연결
4. **노드 상세 modal 대안** - 상세 패널 모듈 분리
5. **모바일 Responsive** - 별도 모바일 에디터 또는 반응형 캔버스
