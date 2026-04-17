---
description: 스프린트 A+B+C 통합 TODO - 공통화 + Editor 안정화 + 미디어 표준화
---

# LoveBud 스프린트 A+B+C 통합 작업 지시문

> **시작 커밋:** `edde92f`  
> **목표:** 공통화 완성 + Editor 안정화 + 미디어 처리 표준화  
> **예상 소요:** 대형 (6-10시간 분량)  
> **완료 기준:** 문서 하단 참조

---

## 파트 0: 시작 전 필수 확인

### 0.1 현재 기준 문서 (반드시 먼저 읽기)
```
docs/engineering/API_CONTRACT.md
docs/engineering/RECENT_REFACTORING.md
docs/engineering/COMMON_CODE_CANDIDATES.md
docs/engineering/CTO_REPORT_20260418.md
docs/engineering/engineering_index.md
```

### 0.2 현재 코드 상태
- `detail.js`: 안정화 완료 ✅
- `normalize.js`: Memory 정규화만 있음 (Tree 없음)
- `editor.js`: 부분적 legacy 제거, 안정성 점검 필요
- `search.js`: Tree 정규화 중복 있음
- `my-trees.js`: 일부 legacy 제거됨

### 0.3 원칙 (위반 시 롤백)
1. `{id, data}` 복원 금지
2. flat camelCase 표준 유지
3. UI 큰 변화 금지
4. 기능 추가 금지 (정리만)
5. 문서-코드 동기화 필수

---

## 파트 1: 스프린트 A - 공통화 완성 (2-3시간)

### TODO A1: normalize.js 확장

**파일:** `js/utils/normalize.js`

**추가할 함수:**
```javascript
/**
 * Tree 객체를 flat camelCase 표준으로 정규화
 * @param {Object} tree - 원본 트리 객체
 * @returns {Object} 정규화된 트리
 */
function normalizeTree(tree) {
  if (!tree) return null;
  return {
    id: tree.id,
    userId: tree.userId || tree.user_id || null,
    title: tree.title || '나의 러브트리',
    visibility: tree.visibility || 'private',
    createdAt: tree.createdAt || tree.created_at || null,
    updatedAt: tree.updatedAt || tree.updated_at || null,
    memoryCount: tree.memoryCount || tree.memory_count || 0,
    isArchived: tree.isArchived || tree.is_archived || false
  };
}

/**
 * Tree 배열 정규화
 * @param {Array} list - 원본 트리 배열
 * @returns {Array} 정규화된 트리 배열
 */
function normalizeTreeList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeTree).filter(Boolean);
}

/**
 * 감정 태그 정규화 (중복 제거, 빈값 필터)
 * @param {Array} tags - 원본 태그 배열
 * @returns {Array} 정규화된 태그 배열
 */
function normalizeEmotionTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter(Boolean))];
}
```

**전역 노출 확인:**
```javascript
window.LoveBudNormalize = {
  normalizeMemory,
  normalizeMemoryList,
  normalizeTree,        // 새로 추가
  normalizeTreeList,    // 새로 추가
  normalizeEmotionTags  // 새로 추가
};
```

**완료 체크:**
- [ ] `normalizeTree` 구현
- [ ] `normalizeTreeList` 구현
- [ ] `normalizeEmotionTags` 구현
- [ ] window 전역 노출 확인
- [ ] 기존 `normalizeMemory`와 스타일 일관성

---

### TODO A2: search.js 공통화 적용

**파일:** `js/search.js`

**변경할 부분 (line ~73):**
```javascript
// 변경 전:
const emotionTags = m.emotion_tags || m.emotionTags || [];

// 변경 후:
const normalizedMem = window.LoveBudNormalize.normalizeMemory(m);
const emotionTags = window.LoveBudNormalize.normalizeEmotionTags(normalizedMem.emotionTags);
```

**변경할 부분 (line ~77-80 timeRange 계산):**
```javascript
// 변경 전:
const timestamps = memories
  .map(m => m.timestamp || m.createdAt)
  .filter(Boolean);

// 변경 후:
const timestamps = memories
  .map(m => window.LoveBudNormalize.normalizeMemory(m).timestamp)
  .filter(Boolean);
```

**완료 체크:**
- [ ] emotion_tags 보정 제거
- [ ] normalizeMemory 사용
- [ ] normalizeEmotionTags 사용
- [ ] 렌더링 동작 유지

---

### TODO A3: my-trees.js 공통화 적용

**파일:** `js/my-trees.js`

**변경할 부분 (line ~93-95):**
```javascript
// 변경 전:
var title = tree.title || '나의 러브트리';
var date = tree.updatedAt || tree.createdAt || '';

// 변경 후:
var normalizedTree = window.LoveBudNormalize.normalizeTree(tree);
var title = normalizedTree.title;
var date = normalizedTree.updatedAt || normalizedTree.createdAt || '';
```

**완료 체크:**
- [ ] normalizeTree 사용
- [ ] title/date 처리 중복 제거
- [ ] 레이아웃 변화 없음

---

### TODO A4: ui.js 신규 생성 (Toast 공통화)

**신규 파일:** `js/utils/ui.js`

**구현:**
```javascript
/**
 * LoveBud UI 유틸리티
 * v20260418-1
 */
(function() {
  'use strict';

  const DEFAULT_DURATION = 3000;

  /**
   * 토스트 메시지 표시
   * @param {string} message - 표시할 메시지
   * @param {string} type - 타입: 'info' | 'success' | 'warn' | 'error'
   * @param {number} duration - 표시 시간 (ms)
   */
  function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
    // 기존 토스트 제거
    const existing = document.getElementById('lovebud-toast');
    if (existing) existing.remove();

    // 색상 설정
    const colors = {
      info: '#2e7d32',
      success: '#2e7d32',
      warn: '#ef6c00',
      error: '#c62828'
    };

    // 토스트 생성
    const toast = document.createElement('div');
    toast.id = 'lovebud-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeInUp 0.3s ease;
      max-width: 90vw;
      word-break: break-word;
    `;
    toast.textContent = message;

    // 애니메이션 스타일 추가 (없으면)
    if (!document.getElementById('lovebud-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'lovebud-toast-styles';
      style.textContent = `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // 자동 제거
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 로딩 표시 (향후 확장용)
   */
  function showLoading() {
    // TODO: 향후 구현
    console.log('[LoveBudUI] showLoading called');
  }

  /**
   * 로딩 숨김 (향후 확장용)
   */
  function hideLoading() {
    // TODO: 향후 구현
    console.log('[LoveBudUI] hideLoading called');
  }

  // 전역 노출
  window.LoveBudUI = {
    showToast,
    showLoading,
    hideLoading
  };

  console.log('[LoveBudUI] UI utilities loaded');
})();
```

**HTML에 추가 (2개 파일):**
- `pages/editor.html`: `js/utils/normalize.js` 다음에 추가
- `pages/my-trees.html`: `js/utils/ui.js` 추가 (없으면)

```html
<script src="../js/utils/ui.js?v=20260418-1"></script>
```

**완료 체크:**
- [ ] ui.js 파일 생성
- [ ] showToast 구현
- [ ] window.LoveBudUI 노출
- [ ] editor.html에 script 태그 추가
- [ ] my-trees.html에 script 태그 추가

---

### TODO A5: editor.js Toast 교체

**파일:** `js/editor.js`

**변경할 부분 (line ~44-65):**
```javascript
// 변경 전: 내부 showToast 함수
const showToast = (message, type = 'info') => { ... };

// 변경 후: 공통 유틸 사용
const showToast = window.LoveBudUI?.showToast || ((message, type = 'info') => {
  // fallback: 간단한 alert 또는 console
  console.log(`[Toast ${type}] ${message}`);
});
```

**완료 체크:**
- [ ] 내부 showToast 제거 또는 공통 유틸 사용
- [ ] 동작 유지 확인

---

### TODO A6: my-trees.js Toast 교체

**파일:** `js/my-trees.js`

**변경할 부분 (line ~16-30):**
```javascript
// 변경 전: 내부 showToast 함수
function showToast(message, type) { ... }

// 변경 후: 공통 유틸 사용
function showToast(message, type) {
  if (window.LoveBudUI?.showToast) {
    window.LoveBudUI.showToast(message, type);
  } else {
    // fallback
    console.log(`[Toast ${type}] ${message}`);
  }
}
```

**완료 체크:**
- [ ] 공통 유틸 사용
- [ ] fallback 유지

---

### TODO A7: path.js 신규 생성 (최소 범위)

**신규 파일:** `js/utils/path.js`

**구현 (최소 버전):**
```javascript
/**
 * LoveBud 경로 유틸리티
 * v20260418-1
 */
(function() {
  'use strict';

  /**
   * 현재 페이지가 /pages/ 컨텍스트인지 확인
   * @returns {boolean}
   */
  function isPagesContext() {
    return window.location.pathname.indexOf('/pages/') !== -1;
  }

  /**
   * basePath 반환
   * @returns {string} '' 또는 'pages/'
   */
  function getBasePath() {
    return isPagesContext() ? '' : 'pages/';
  }

  /**
   * 페이지 URL 생성
   * @param {string} pageName - 예: 'detail.html', 'search.html'
   * @returns {string} 완성된 경로
   */
  function resolvePageUrl(pageName) {
    return getBasePath() + pageName;
  }

  // 전역 노출
  window.LoveBudPath = {
    isPagesContext,
    getBasePath,
    resolvePageUrl
  };

  console.log('[LoveBudPath] Path utilities loaded');
})();
```

**완료 체크:**
- [ ] path.js 파일 생성
- [ ] 기본 함수 3개 구현
- [ ] window.LoveBudPath 노출

---

### TODO A8: path.js 시범 적용 (1-2개 파일만)

**적용 대상:** `js/search.js` 또는 `js/detail.js` 중 1개

**예시 (search.js):**
```javascript
// 변경 전:
var basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';

// 변경 후:
var basePath = window.LoveBudPath?.getBasePath() || 
  (window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/');
```

**완료 체크:**
- [ ] 1개 파일에 적용
- [ ] fallback 유지
- [ ] 동작 확인

---

## 파트 2: 스프린트 B - Editor 안정화 (2-3시간)

### TODO B1: editor.js DOM null-safe 점검 및 보강

**파일:** `js/editor.js`

**점검 대상 라인:**
- line ~394: `detailPanel.querySelector('h3')`
- line ~414: `detailPanel.querySelector('.detail-video img')`
- line ~419: `document.getElementById('detailDateText')`
- line ~422: `detailPanel.querySelector('.tags-container')`
- line ~430: `detailPanel.querySelector('.diary-note')`

**보강 패턴:**
```javascript
// 변경 전:
const headerEl = detailPanel.querySelector('h3');
if (headerEl) { ... }

// 변경 후 (더 안전하게):
const headerEl = detailPanel?.querySelector('h3');
if (!headerEl) {
  console.warn('[editor] headerEl not found');
  return;
}
```

**완료 체크:**
- [ ] 주요 DOM 접근점 null-safe 강화
- [ ] console.warn 추가
- [ ] 조기 리턴 패턴 적용

---

### TODO B2: editor.js normalize 적용 일관성 확인

**파일:** `js/editor.js`

**점검 대상:**
- line ~200: normalizeMemory fallback 확인
- line ~229: cachedMemories 정규화
- line ~260: memories 정규화
- line ~284: treeMemories 함수

**수정 필요 시:**
```javascript
// ensure normalize is available
const normalizeMemory = window.LoveBudNormalize?.normalizeMemory || ((mem) => {
  console.warn('[editor] LoveBudNormalize not available, using minimal fallback');
  return mem ? { ...mem } : null;
});
```

**완료 체크:**
- [ ] normalizeMemory 일관성 확인
- [ ] fallback 메시지 개선

---

### TODO B3: editor.js API 실패 fallback 안전성

**파일:** `js/editor.js`

**점검 대상:**
- line ~99: getTree 실패
- line ~130: createTree 실패
- line ~165: getFirstTree 실패
- line ~251: getMemoriesByTree 실패

**보강:**
```javascript
// 각 catch 블록에 공통 패턴
catch (e) {
  const i18n = window.t || ((k) => k);
  console.warn('[editor] API failed:', e.message);
  
  // 사용자 알림 (선택적)
  if (window.LoveBudUI?.showToast) {
    window.LoveBudUI.showToast(i18n('data_load_error'), 'warn');
  }
  
  // fallback 로직...
}
```

**완료 체크:**
- [ ] 주요 API 호출 에러 핸들링 개선
- [ ] 사용자 피드백 추가

---

### TODO B4: editor.js create/update/delete 후 렌더 검증

**파일:** `js/editor.js`

**점검 대상:**
- `saveMemoryEdit` (line ~476)
- `deleteMemory` (line ~519)

**보강 포인트:**
```javascript
// update 후 검증
const memIndex = window.currentTreeMemories.findIndex(m => m.id === currentEditingMemory.id);
if (memIndex >= 0) {
  window.currentTreeMemories[memIndex] = { ...window.currentTreeMemories[memIndex], ...payload };
} else {
  console.warn('[editor] Memory not found in currentTreeMemories after update');
}
```

**완료 체크:**
- [ ] CRUD 후 상태 검증 추가
- [ ] 오류 로깅 개선

---

### TODO B5: editor.js 콘솔 로그 정리

**파일:** `js/editor.js`

**정리 대상:**
- 불필요한 debug 로그
- 중복 로그
- 실제 상태와 맞지 않는 로그 메시지

**보존:**
- 에러/경고 로그
- 주요 상태 변화 로그

**완료 체크:**
- [ ] 과도한 debug 로그 제거
- [ ] 주요 로그는 유지

---

## 파트 3: 스프린트 C - 미디어 처리 표준화 (1-2시간, 최소 범위)

### TODO C1: media.js 신규 생성 (최소 버전)

**신규 파일:** `js/utils/media.js`

**구현:**
```javascript
/**
 * LoveBud 미디어 유틸리티
 * v20260418-1
 */
(function() {
  'use strict';

  /**
   * YouTube URL에서 비디오 ID 추출
   * @param {string} url - YouTube URL
   * @returns {string|null} 비디오 ID
   */
  function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  /**
   * 임베드 URL 생성
   * @param {string} sourceUrl - 원본 URL
   * @param {string} type - 소스 타입 (현재 youtube만 지원)
   * @returns {string|null} 임베드 URL
   */
  function getEmbedUrl(sourceUrl, type = 'youtube') {
    if (type === 'youtube') {
      const videoId = extractYouTubeId(sourceUrl);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    return null;
  }

  /**
   * 썸네일 URL 생성
   * @param {string} sourceUrl - 원본 URL
   * @param {string} type - 소스 타입
   * @returns {string|null} 썸네일 URL
   */
  function getThumbnailUrl(sourceUrl, type = 'youtube') {
    if (type === 'youtube') {
      const videoId = extractYouTubeId(sourceUrl);
      return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
    }
    return null;
  }

  /**
   * 소스 URL 유효성 검사
   * @param {string} url - 검사할 URL
   * @returns {boolean}
   */
  function validateSourceUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return extractYouTubeId(url) !== null;
  }

  // 전역 노출
  window.LoveBudMedia = {
    extractYouTubeId,
    getEmbedUrl,
    getThumbnailUrl,
    validateSourceUrl
  };

  console.log('[LoveBudMedia] Media utilities loaded');
})();
```

**완료 체크:**
- [ ] media.js 파일 생성
- [ ] YouTube 관련 함수 구현
- [ ] window.LoveBudMedia 노출

---

### TODO C2: media.js 시범 적용 (1개 파일)

**적용 대상:** `js/detail.js` 또는 `js/search.js` 중 1개

**예시 (detail.js):**
```javascript
// 변경 전:
function getYouTubeId(url) { ... }

// 변경 후:
const videoId = window.LoveBudMedia?.extractYouTubeId(sourceUrl) || extractYouTubeIdFallback(sourceUrl);
```

**완료 체크:**
- [ ] 1개 파일에 적용
- [ ] fallback 유지

---

## 파트 4: 문서 갱신 (1시간)

### TODO D1: COMMON_CODE_CANDIDATES.md 갱신

**파일:** `docs/engineering/COMMON_CODE_CANDIDATES.md`

**갱신 내용:**
- 완료된 후보는 ✅ 표시
- 새로 발견된 후보 추가
- 상태 변경 반영

```markdown
## 공통화 가치 순위 (갱신)

| 순위 | 패턴 | 상태 |
|------|------|------|
| 1 | Tree normalize | ✅ 완료 (normalize.js 확장) |
| 2 | Toast/Notification | ✅ 완료 (ui.js 신규) |
| 3 | basePath 처리 | 🔄 시범 적용 |
| 4 | Date formatting | ⏳ 보류 |
| 5 | sourceUrl 처리 | 🔄 media.js 시범 |
```

---

### TODO D2: RECENT_REFACTORING.md 갱신

**파일:** `docs/engineering/RECENT_REFACTORING.md`

**추가할 단계:**
```markdown
## 추가 단계 (이번 스프린트)

### 커밋: 공통화 완성
- `js/utils/normalize.js` 확장 (Tree, emotionTags)
- `js/utils/ui.js` 신규 (Toast 공통화)
- `js/utils/path.js` 신규 (시범)
- `js/utils/media.js` 신규 (시범)
- `search.js`, `my-trees.js` 공통화 적용
- `editor.js` Toast 교체

### 남은 과제
- path.js 전면 적용
- media.js 전면 적용
- editor.js 안정성 2차
```

---

### TODO D3: CTO_REPORT 갱신 또는 신규

**파일:** `docs/engineering/CTO_REPORT_202604XX.md` (새 날짜)

**핵심 내용:**
- 스프린트 A 완료 상태
- 스프린트 B 진행 상태
- 스프린트 C 진행 상태
- 다음 추천 작업 3개

---

## 파트 5: 기술부채 청소 (30분)

### TODO E1: 낮은 위험 legacy 코드 제거

**대상 파일:**
- `js/search.js`
- `js/editor.js`
- `js/my-trees.js`
- `js/utils/normalize.js`

**제거 대상:**
- [ ] `{id, data}` 시대 잔재 (남아있는지 확인)
- [ ] 틀린 주석
- [ ] 동작과 맞지 않는 로그
- [ ] 불필요한 중복 fallback

**원칙:**
- 지금 바로 지워도 안전한 것만 제거
- 애매하면 제거하지 말고 보고서에 남길 것

---

## 파트 6: 최종 인수인계 보고서 (30분)

### TODO F1: 보고서 작성

**필수 포함 항목:**

1. **이번 스프린트에서 실제 완료한 것**
   - 완료한 TODO 목록

2. **코드로 반영한 것 vs 문서로만 남긴 것**
   - 명확한 구분

3. **editor.js 상태 평가**
   - 안정성 등급 (1-5)
   - 남은 위험 포인트

4. **search/my-trees 공통화 상태**
   - normalize 적용 범위
   - 남은 중복

5. **path/media 공통화 적용 여부**
   - 적용한 파일
   - 보류한 파일과 이유

6. **남은 리스크**
   - 높음/중간/낮음 분류

7. **다음 스프린트 추천 3개**
   - 우선순위와 근거

8. **"지금 바로 다음 모델이 할 일" 1개**
   - 아주 구체적인 지시문

---

## 완료 기준 (체크리스트)

### 필수 완료 항목
- [ ] normalize.js 확장 (Tree, emotionTags)
- [ ] ui.js 신규 (Toast)
- [ ] search.js 공통화 적용
- [ ] my-trees.js 공통화 적용
- [ ] editor.js Toast 교체
- [ ] editor.js 안정성 1차 보강
- [ ] COMMON_CODE_CANDIDATES.md 갱신
- [ ] RECENT_REFACTORING.md 갱신
- [ ] 최종 CTO 인수인계 보고서

### 선택 완료 항목
- [ ] path.js 신규
- [ ] path.js 시범 적용
- [ ] media.js 신규
- [ ] media.js 시범 적용
- [ ] editor.js 추가 안정성 작업
- [ ] 기술부채 추가 청소

---

## 제출 형식

반드시 아래 순서대로 제출:

1. **전체 변경 요약** (3줄 요약)
2. **수정/작성한 파일 목록** (표 형식)
3. **수정한 전체 코드** (파일별 전체)
4. **작성/갱신한 문서 전체 본문**
5. **스프린트별 완료 상태** (A/B/C)
6. **editor.js 상태 평가**
7. **공통화 진행 결과** (표)
8. **기술부채 청소 결과**
9. **수동 테스트 체크리스트**
10. **위험 요소**
11. **최종 CTO 인수인계 보고서**

---

## 주의사항

1. **기능 추가 금지** - 정리만 할 것
2. **UI 큰 변화 금지** - 기존 스타일 유지
3. **커밋 분리 권장** - 코드/문서 분리
4. **전체 코드 제공** - diff만 금지
5. **파일 경로 명확히** - 상대경로 금지
6. **너무 큰 변경 금지** - 보류하고 문서에 남길 것

---

**이 지시문을 받은 모델은 위 TODO 순서대로 작업을 진행하고, 완료 기준을 만족하면 제출 형식에 따라 보고서를 작성하라.**
