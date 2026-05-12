# search (둘러보기)

## 페이지 목적
공유된 공개 트리를 탐색하고 감상하는 페이지. 커뮤니티에서 다른 팬들의 러브트리를 둘러봄.

## 사용자 목표
1. 공개된 트리 목록 탐색
2. 필터로 트리 단계 확인 (입덕/성장/최애)
3. 키워드로 트리 검색
4. 트리 선택 → 상세 페이지로 이동

---

## 현재 구현 상태

### 주요 UI 섹션
- **검색 입력창**: 키워드 검색
- **필터 칩**: 전체 / 입덕 순간 / 성장 과정 / 최애 확정
- **Results Grid**: 트리 카드 그리드
- **Preview Panel**: 선택 트리 미리보기

### 현재 파일 구조
- `pages/search.html` (inline CSS 포함, script/vendor modules)
- `js/search/index.js` (orchestrator)
- `js/search/search-title-helper.js` (제목/태그/날짜 helper)
- `js/search/search-data-adapter.js` (data layer, PR #1058에서 source URL 정규화)
- `js/search/search-shared-utils.js` (공유 유틸리티)
- `js/search/search-card-renderer.js` (카드 렌더링)
- `js/search/search-preview-media-helper.js` (미디어/썸네일 helper)
- `js/search/search-preview-media-embed-patch.js` (PR #1058: YouTube iframe 소스 정규화)
- `js/search/search-preview-copy-helper.js` (카피/로케일 포맷 helper)
- `js/search/search-preview-action-helper.js` (CTA/공유 markup helper)
- `js/search/search-preview-renderer-builders.js` (프리뷰 빌더 유틸리티)
- `js/search/search-preview-renderer.js` (프리뷰 패널 DOM 렌더링)
- `js/search/search-preview-playable-hub-patch.js` (PR #1058: 재생 가능 허브 미디어, 흐름 전환, 액션 레이아웃)
- `js/search/search-preview-hub-dom-patch.js` (PR #1058: DOM 레벨 허브 레이아웃 패치, 소셜 바 와이어링)
- `js/search/search-preview-cache.js` (프리뷰 캐시)
- `js/search/search-ui.js` (UI 오케스트레이션)
- `js/search/search-url-state.js` (URL 상태)
- `js/search/search-controls.js` (컨트롤)
- `js/search/search-data.js` (데이터)
- `js/search/search-preview-controller.js` (프리뷰 컨트롤러)
- `js/postgres-client.js` (API facade)

### CSS 파일 구조 (PR #1058 추가 포함)
- `css/search.css` (import hub, PR #1058에서 4개 새 CSS import 추가)
- `css/search/search-base.css`
- `css/search/search-hero-controls.css`
- `css/search/search-controls.css`
- `css/search/search-results-skeleton.css`
- `css/search/search-empty-state.css`
- `css/search/search-growing-trees.css`
- `css/search/search-tree-card.css`
- `css/search/search-card-footer-cleanup.css`
- `css/search/search-preview-sidebar.css`
- `css/search/search-preview-scroll-fix.css` (PR #1058: 허브 독립 스크롤)
- `css/search/search-preview-media-cleanup.css` (PR #1058: 미디어 오버레이 제거)
- `css/search/search-preview-media-no-overlays.css` (PR #1058: Browse 미디어 오버레이 제거)
- `css/search/search-preview-social-bar.css` (PR #1058: 소셜 액션 바)
- `css/search/search-responsive.css`

### 모듈 구조 (v20260512-1058)
```
search.html
├── css/search.css (import hub, PR #1058)
│   ├── search-base.css
│   ├── search-hero-controls.css
│   ├── search-controls.css
│   ├── search-results-skeleton.css
│   ├── search-empty-state.css
│   ├── search-growing-trees.css
│   ├── search-tree-card.css
│   ├── search-card-footer-cleanup.css
│   ├── search-preview-sidebar.css
│   ├── search-preview-scroll-fix.css      ← PR #1058
│   ├── search-preview-media-cleanup.css    ← PR #1058
│   ├── search-preview-media-no-overlays.css ← PR #1058
│   ├── search-preview-social-bar.css       ← PR #1058
│   └── search-responsive.css
├── js/search/index.js (orchestrator)
├── js/search/search-title-helper.js
├── js/search/search-data-adapter.js (data transformation, PR #1058)
├── js/search/search-shared-utils.js
├── js/search/search-card-renderer.js (card + empty state)
├── js/search/search-preview-media-helper.js
├── js/search/search-preview-media-embed-patch.js ← PR #1058
├── js/search/search-preview-copy-helper.js
├── js/search/search-preview-action-helper.js
├── js/search/search-preview-renderer-builders.js
├── js/search/search-preview-renderer.js (preview sidebar)
├── js/search/search-preview-playable-hub-patch.js ← PR #1058
├── js/search/search-preview-hub-dom-patch.js      ← PR #1058
├── js/search/search-preview-cache.js
├── js/search/search-ui.js
├── js/search/search-url-state.js
├── js/search/search-controls.js
├── js/search/search-data.js
└── js/search/search-preview-controller.js
```

### 데이터 계층 (js/search/search-data-adapter.js)
- `buildTreeData(memories, trees)` - raw data → view models
- `filterTrees(trees, query, category)` - query + category filtering
- `estimateStage(count)` - memory count → stage (입덕/성장/최애)
- `calculateTimeRange(memories)` - timestamps → range string
- `collectEmotionTags(memories)` - memories → unique tags (max 3)

### 렌더 계층 (분리된 rendering 모듈)

**Card Rendering (search-card-renderer.js)**
- `renderTreeCard(tree, index)` - single card HTML
- `renderResults(trees, options)` - batch render
- `renderNoTreesState()` - no data empty state
- `renderEmptySearchState()` - no results state
- `attachCardEvents(cardEl, tree)` - click/hover binding

**Preview Rendering (search-preview-renderer.js)**
- `updatePreview(tree)` - preview panel DOM update
- `resetPreview()` - placeholder state

### 주요 기능
- 캐시 우선 렌더링 + background API refresh
- 데이터 가공과 UI 렌더링 분리
- 필터: stage 기반 (입덕/성장/최애)
- 검색: 제목, 테마, memory 제목/아티스트 검색
- 인피니티 스크롤 (page size 12)

---

## 현재 잘 되는 것

| 항목 | 상태 |
|------|------|
| 캐시 우선 | ✅ LoveBudCache에서 public_trees_list 캐시 |
| 배경 새로고침 | ✅ API 호출 후 캐시 업데이트 |
| 필터 작동 | ✅ stage 기반 filter chips |
| 검색 | ✅ 제목, theme, memory fields 검색 |
| 카드 렌더링 | ✅ memoryCount, emotionTags, timeRange 표시 |
| 에러 처리 | ✅ API 실패 시 mock fallback (search.js의 buildTreeData) |

---

## 현재 문제/리스크

| 문제 | 설명 |
|------|------|
| Public 데이터 부족 | DB에 public tree가 부족 → browse가 빈약 |
| 스키마 불일치 (과거) |visibility 컬럼 vs is_public 불일치 → 최근 수정됨 (`1dcb373`) |
| 문법 오류 (과거) | 중복 filter/brace → 수정됨 (`search.js`) |
| Mock fallback | API 실패 시 mock-data.js 기반 표시 |
| 필터 정확도 | stage가 memoryCount 기반 (2이하=입덕, 4이하=성장, 5이상=최애) |

---

## 상태별 화면

### 1. 로딩 중
- "기억들을 불러오는 중..." 스피너
- 최소 400ms 로딩 시간 보장

### 2. 트리 있음 (성공)
- 검색 입력창 + 필터 칩
- 트리 카드 그리드 (4열)
- 각 카드: 썸네일, 제목, 메모리 수, 감정 태그, 기간, 단계 배지

### 3. 검색/필터 결과
- 검색어 또는 필터 적용 후 결과 업데이트
- 결과 없으면 "검색 결과가 없습니다"

### 4. 빈 상태 (결과 없음)
- 검색 결과 없음 메시지
- 필터에서 "전체" 선택 권장

### 5. 에러
- API 실패 시 mock fallback
- console.warn으로 에러 로그

---

## 필요한 데이터/API

| 데이터 | 소스 | 비고 |
|--------|------|------|
| public trees | `apiClient.getPublicTrees()` | payload.nodes 포함 |
| trees list | `apiFetch('/trees')` | GET |
| mock fallback | `getTrees()`, `memories` (mock-data.js) | |

---

## 향후 확장 포인트

### 데이터 계층 확장
- `js/search/search-data-adapter.js`에 새로운 필터 로직 추가 (아티스트, 태그)
- 페이지네이션 지원 (`filterTrees`에 offset, limit 파라미터)
- 정렬 옵션 추가 (최신, 오래된, 메모리 수)

### 렌더 계층 확장
- 카드 레이아웃variants (grid/list toggle)
- Virtual scrolling for large datasets
-Skeleton loading states

### 새 모듈 추가 예시
```javascript
// search.SortOptions.js
window.LoveBudSearchSort = {
  sortByDate: (trees, order) => { /* ... */ },
  sortByMemoryCount: (trees, order) => { /* ... */ }
};
```

```javascript
// search.Pagination.js
window.LoveBudSearchPagination = {
  getPage: (trees, page, pageSize) => { /* ... */ },
  getPageCount: (total, pageSize) => { /* ... */ }
};
```

---

## 다음 개선 포인트

1. Public 트리 시드 실제 실행 (phase1)
2. 미리보기 패널rich하게 (현재 간단한 정보만)
3. 감상 모드 experiência (현재는 단순 카드列表)
4. 무한 스크롤 실제 구현 (코드에는 page size 12 정의, 실제 동작은?)
5. 필터 종류 확대 (아티스트, 감정 태그 등)
