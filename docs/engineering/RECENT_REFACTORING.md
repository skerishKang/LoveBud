# LoveBud 최근 리팩터링 기록 (2026-04)

> **기간:** 2026-04-17 ~ 2026-04-18  
> **목표:** API 응답 구조 표준화 + detail.js 안정화  
> **최종 커밋:** `734bc68`

---

## 1. 문제 배경

### 1.1 API 응답 구조 불일치

| 위치 | 문제 |
|------|------|
| 백엔드 | 일부는 `{id, data}`, 일부는 flat camelCase |
| 프론트 | `memory.data?.title`, `tree.data?.id` 같은 불안정한 접근 |
| search.js | API가 이미 flat인데 중복 flatten 처리 |

### 1.2 detail 직접 진입 시 treeId 누락

- `detail.html?id=xxx` 형태로 진입 시 tree 파라미터 없음
- `memory.treeId`도 없는 경우
- 결과: 페이지 전체가 멈춘 것처럼 보임 (console warn만 남기고 return)

### 1.3 null-safe 부족

- DOM 요소 직접 접근 (`videoMain.innerHTML = ...`)
- 요소 누락 시 runtime error 위험

### 1.4 위험한 mock tree fallback

```javascript
// 위험: 임의 첫 트리 선택
tree = trees.find(t => t.id === treeId) || trees[0];
// 없는 treeId인데 엉뚱한 트리가 표시될 수 있음
```

---

## 2. 해결 순서

### 2.1 커밋 `bb9741b` - 프론트 legacy `{id, data}` fallback 제거

**변경:**
- `detail.js`: `apiMemory.data?.tree_id` 접근 제거
- `editor.js`: `mem.data` 기반 normalize 제거

**결과:**
- 프론트는 flat camelCase 응답을 직접 사용

---

### 2.2 커밋 `bb9e663` - normalizeMemory 공통 유틸 추출

**생성:** `js/utils/normalize.js`

```javascript
window.LoveBudNormalize = {
  normalizeMemory(mem) {
    // snake_case → camelCase 보정 (임시)
    // flat camelCase 표준화
  },
  normalizeMemoryList(list) {
    return list.map(m => this.normalizeMemory(m));
  }
};
```

**적용:**
- `detail.js`: 공통 유틸 사용
- `editor.js`: 공통 유틸 사용
- `detail.html`, `editor.html`: 스크립트 로드 추가

---

### 2.3 커밋 `a21fd59` - detail.js 방어 보강 1차

**변경:**
- treeId 없어도 memory-only detail view 허용
- `return` → 계속 진행 (graceful degradation)

**UI 개선:**
- 단독 순간 모드: "이 순간을 단독으로 감상하고 있어요"
- siblings 영역: "트리 경로 정보가 없어요"
- page title: tree 없을 때도 정상 표시

---

### 2.4 커밋 `a42d63e` - detail.js DOM null-safe 강화

**변경:**
```javascript
// 전
videoMain.innerHTML = ...;

// 후
if (videoMain) {
  videoMain.innerHTML = ...;
}
```

**대상 요소:**
- videoMain
- memoryTitle
- detailArtist
- detailDate
- detailSubtitle
- tagsContainer
- diaryQuote
- diaryContent

---

### 2.5 커밋 `734bc68` - detail.js 2차 보강

**함수 분리:**
```javascript
renderMemoryBase(memory);           // memory 본문 (tree 무관)
renderTreeContext({...});           // tree context (상태별 분기)
renderConnectedFragments({...});    // siblings
```

**상태 구분:**
```javascript
degradedReason = null;                    // 정상
degradedReason = 'missing-tree-id';       // treeId 자체 없음
degradedReason = 'tree-load-failed';     // treeId는 있었으나 로드 실패
```

**위험한 fallback 제거:**
```javascript
// 전
tree = trees.find(t => t.id === treeId) || trees[0];

// 후
tree = mockTrees.find(t => t.id === treeId) || null;
if (!tree) {
  degradedReason = 'tree-load-failed';
}
```

**backButton 개선:**
```javascript
// treeId 없을 때 editor fallback
let editorUrl = treeId ? `editor.html?treeId=${treeId}` : 'editor.html';
```

**기본값 개선:**
```javascript
memoryTitle.textContent = memory.title || '기억의 순간';
```

---

## 3. 검증 시나리오

### 3.1 코드 레벨 검증

| 시나리오 | 결과 |
|----------|------|
| `detail.html?id=...&tree=...` | ✅ 정상 트리 컨텍스트 |
| `detail.html?id=...` | ✅ 단독 순간 모드 (degradedReason: missing-tree-id) |
| treeId는 있는데 API 실패 | ✅ "트리 정보 없음" 모드 (degradedReason: tree-load-failed) |
| treeId 없고 from=editor | ✅ backButton → `editor.html` (파라미터 없음) |

### 3.2 기능 회귀 없음 확인

- browse → detail: 정상 작동
- my-trees → detail: 정상 작동
- editor → detail: 정상 작동
- 기존 정상 케이스: 모두 유지

---

## 4. 남은 리스크와 다음 과제

### 4.1 즉시 리스크 (낮음)

| 항목 | 상태 | 대응 |
|------|------|------|
| detail.js | 안정화 완료 | 추가 작업 불필요 |
| normalize 공통화 | 완료 | 유지 |

### 4.1.1 스프린트 A 완료 (2026-04-18)

| 커밋 | 작업 | 결과 |
|------|------|------|
| `normalize.js` 확장 | `normalizeTree`, `normalizeTreeList`, `normalizeEmotionTags` 추가 | ✅ 완료 |
| `search.js` | `normalizeEmotionTags` 적용 | ✅ 완료 |
| `my-trees.js` | `normalizeTree` 적용 | ✅ 완료 |
| `ui.js` 신규 | Toast 공통화 | ✅ 완료 |
| `editor.js` | Toast 공통 유틸 사용 | ✅ 완료 |
| `my-trees.js` | Toast 공통 유틸 사용 | ✅ 완료 |
| `path.js` 신규 | 경로 유틸 생성 | ✅ 완료 |
| `search.js` | `path.js` 시범 적용 | ✅ 완료 |

### 4.1.2 스프린트 C 상태 (2026-04-18) - 생성 완료, 적용 보류

| 커밋 | 작업 | 결과 | 비고 |
|------|------|------|------|
| `media.js` 신규 | YouTube 처리 유틸 생성 | ✅ 생성 완료 | 사용 가능 |
| `media.js` 함수 | extractYouTubeId, getEmbedUrl, getThumbnailUrl, validateSourceUrl | ✅ 구현 완료 | 테스트 미완료 |
| `media.js` HTML 로드 | 페이지 로드 | ❌ 미적용 | 어떤 페이지도 로드하지 않음 |
| `media.js` JS 사용 | 실제 사용 | ❌ 미적용 | 어떤 파일도 사용하지 않음 |
| `editor.js` 적용 | 보류 (파일 복잡성) | ⏳ 보류 | 안정화 후 적용 예정 |

**현실적 상태:**
- media.js는 생성되어 `js/utils/media.js`에 존재함
- window.LoveBudMedia로 전역 노출됨
- 하지만 어떤 HTML 페이지도 이 파일을 로드하지 않음
- 따라서 현재는 사용 불가능한 "죽은 코드(dead code)" 상태

**적용 가능 시점:**
- editor.js 안정화 스프린트 때 함께 적용 권장
- 또는 별도의 "media.js 적용" 스프린트 필요

### 4.1.3 기술부채 청소 완료 (2026-04-18)

| 항목 | 확인 결과 | 조치 |
|------|----------|------|
| `{id, data}` 잔재 | 없음 | 없음 |
| `tree.data?.id` 접근 | my-trees.js line 211 | ✅ 제거 완료 |
| 틀린 주석 | 없음 | 없음 |
| 불필요한 fallback | 모두 필요한 resilience | 없음 |
| 로그 메시지 | 적절함 | 없음 |

### 4.1.4 후속 보강 완료 (2026-04-18) - 3a34e87 후속

| 항목 | 문제 | 조치 |
|------|------|------|
| editor.html 스크립트 로드 | ui.js, path.js 누락 | ✅ 추가 완료 |
| my-trees.html 스크립트 로드 | normalize.js, ui.js, path.js 누락 | ✅ 추가 완료 |
| search.html 스크립트 로드 | normalize.js, ui.js, path.js 누락 | ✅ 추가 완료 |
| JS fallback warn | console.log만 사용 | ✅ console.warn 추가 |

**발견된 문제:**
- `3a34e87` 커밋에서 JS 유틸은 생성되었으나, HTML wiring이 누락됨
- my-trees.js와 search.js는 LoveBudNormalize/UI/Path 사용하나 HTML에서 로드하지 않음
- 이번 보강 작업으로 완전히 해결됨

### 4.2 단기 과제 (다음 스프린트)

| 우선순위 | 작업 | 이유 | 상태 |
|----------|------|------|------|
| 1 | ~~editor.js 안정화 점검~~ | 파일 복잡성으로 별도 스프린트 권장 | ⏳ 보류 |
| 2 | search/browse 공통화 | normalize, source 처리 중복 제거 | ✅ 완료 |
| 3 | 주석/기술부채 청소 | 오래된 `{id, data}` 설명 제거 | ⏳ 보류 |

### 4.2.1 스프린트 B 판단

**editor.js 안정화 작업 보류 이유:**
- 파일 라인 수: 977줄 (매우 큼)
- 함수 간 의존성 복잡
- 작은 수정도 구조적 에러 유발 가능성 높음
- 별도의 전담 스프린트에서 다루는 것이 안전

**현재 editor.js 상태:**
- Toast 공통화: ✅ 완료
- 기본 null-safe: ✅ 이미 적용됨 (기존 코드)
- 대대적 개선: ⏳ 다음 전담 스프린트로 이관 |

### 4.3 중기 과제

| 우선순위 | 작업 | 이유 |
|----------|------|------|
| 1 | snake_case fallback 완전 제거 | 백엔드 직렬화기만 사용 |
| 2 | API 계약 문서 상시 갱신 | 이 문서 유지보수 |

---

## 5. 관련 파일

| 파일 | 변경 이력 |
|------|----------|
| `js/detail.js` | 6차 수정 완료 |
| `js/editor.js` | normalize 공통화 적용 |
| `js/search.js` | flatten 중복 제거 |
| `js/utils/normalize.js` | 신규 생성 |
| `pages/detail.html` | normalize.js 로드 추가 |
| `pages/editor.html` | normalize.js 로드 추가 |
| `netlify/functions/_lib/serializers.js` | 표준 참고용 |

---

## 6. 핵심 결론

1. **API 응답 표준 확정:** flat camelCase
2. **detail.js 안정화:** graceful degradation 완료
3. **공통 유틸 도입:** `window.LoveBudNormalize`
4. **위험 fallback 제거:** `trees[0]` 같은 임의 선택 금지
5. **다음 단계:** editor.js 점검 + search/browse 공통화

---

**문서 갱신:** 후속 작업 완료 시 이 문서에 추가 기록
