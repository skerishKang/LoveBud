# LoveBud 공통화 후보 목록

> **버전:** 1.0  
> **갱신:** 2026-04-18  
> **목적:** 다음 리팩터링 대상 후보 발굴

---

## 조사 대상 파일

| 파일 | 역할 | 라인 수 |
|------|------|---------|
| `js/search.js` | 둘러보기/검색 | 478 |
| `js/my-trees.js` | 내 트리 목록 | 366 |
| `js/detail.js` | 상세 보기 | 403 |
| `js/editor.js` | 에디터 | 977 |
| `js/api-client.js` | API 클라이언트 | ~200 |

---

## 발견된 중복 패턴

### 1. Tree 데이터 정규화 중복 ⭐⭐⭐⭐⭐

**위치:**
- `js/search.js:73` - `m.emotion_tags || m.emotionTags`
- `js/my-trees.js:93-95` - `tree.title`, `tree.updatedAt` fallbacks
- `js/detail.js` - `window.LoveBudNormalize` 사용 (표준)
- `js/editor.js:200-224` - 인라인 normalize fallback

**문제:**
각 파일마다 snake_case/camelCase 보정이 중복되어 있습니다.

**제안:**
```javascript
// js/utils/normalize.js에 추가
window.LoveBudNormalize.normalizeTree(tree)
```

**적용 대상:**
- [ ] `js/search.js`
- [ ] `js/my-trees.js`

---

### 2. source/sourceUrl/sourceType 처리 중복 ⭐⭐⭐⭐

**위치:**
- `js/search.js:398` - `firstMem.sourceUrl`
- `js/detail.js:256` - `memory.sourceUrl`
- `js/editor.js` - (동일 패턴 예상)
- `js/utils/normalize.js:34` - 보정 포함

**문제:**
sourceUrl 유효성 검사, embed URL 변환 로직이 중복될 가능성.

**제안:**
```javascript
// js/utils/media.js 신규
window.LoveBudMedia = {
  getEmbedUrl(sourceUrl, type = 'youtube'),
  validateSourceUrl(url),
  getThumbnailUrl(sourceUrl, type)
};
```

---

### 3. emotionTags 보정 중복 ⭐⭐⭐⭐

**위치:**
- `js/search.js:73` - `m.emotion_tags || m.emotionTags || []`
- `js/utils/normalize.js:36` - `mem.emotionTags || mem.emotion_tags || []`

**문제:**
빈 태그 처리, 중복 제거, 슬라이싱 로직이 각 파일에 흩어져 있음.

**제안:**
```javascript
// normalize.js에 추가
function normalizeEmotionTags(tags) {
  const normalized = (tags || []).filter(Boolean);
  return [...new Set(normalized)]; // 중복 제거
}
```

---

### 4. timestamp/date formatting 중복 ⭐⭐⭐

**위치:**
- `js/search.js:77-80` - timeRange 계산
- `js/my-trees.js:96-98` - `date.slice(0, 10).replace(/-/g, '.')`
- `js/detail.js:278` - `memory.timestamp || ''`

**문제:**
날짜 포맷팅이 각 파일마다 제각각.

**제안:**
```javascript
// js/utils/date.js 신규
window.LoveBudDate = {
  formatDisplay(timestamp),      // '2026.04.18'
  formatRange(start, end),      // '2026.04.01 ~ 2026.04.18'
  parseTimestamp(ts)            // 안전한 파싱
};
```

---

### 5. basePath/pagesContext 처리 중복 ⭐⭐⭐

**위치:**
- `js/search.js:3-6` - `getBasePath()`
- `js/detail.js:19` - `isPagesContext`
- `js/editor.js:170` - `basePath` 계산

**문제:**
`/pages/` 경로 여부 체크가 각 파일에 중복.

**제안:**
```javascript
// js/utils/path.js 신규 (또는 기존 강화)
window.LoveBudPath = {
  getBasePath(),
  isPagesContext(),
  resolvePageUrl(pageName)      // 'search.html' -> 'pages/search.html' 또는 'search.html'
};
```

---

### 6. sourceContext/backButton 규칙 중복 ⭐⭐

**위치:**
- `js/detail.js:27` - `sourceContext` 계산
- `js/detail.js:388-393` - `backConfig`

**문제:**
backButton 설정 규칙이 detail.js에만 있음. 다른 페이지에서도 필요할 수 있음.

**제안:**
```javascript
// js/utils/navigation.js 신규
window.LoveBudNavigation = {
  getBackButtonConfig(sourceContext, treeId),
  resolveReturnUrl(from, treeId)
};
```

---

### 7. Toast/Notification 중복 ⭐⭐

**위치:**
- `js/editor.js:44-65` - `showToast()`
- `js/my-trees.js:16-30` - `showToast()`

**문제:**
토스트 구현이 거의 동일하게 중복.

**제안:**
```javascript
// js/utils/ui.js 신규
window.LoveBudUI = {
  showToast(message, type = 'info', duration = 3000),
  showConfirm(message),
  showLoading()
};
```

---

## 공통화 가치 순위

| 순위 | 패턴 | 영향 파일 수 | 난이도 | 예상 효과 |
|------|------|-------------|--------|----------|
| 1 | Tree normalize | 4 | 하 | 데이터 일관성 |
| 2 | Toast/Notification | 2 | 하 | 코드량 감소 |
| 3 | basePath 처리 | 3 | 하 | 유지보수성 |
| 4 | Date formatting | 3 | 중 | UX 일관성 |
| 5 | sourceUrl 처리 | 3 | 중 | 미디어 처리 표준화 |
| 6 | sourceContext | 2 | 중 | 네비게이션 일관성 |

---

## 다음 실제 리팩터링 후보 2개

### 후보 1: `js/utils/normalize.js` 확장 (추천)

**작업:**
```javascript
// 추가 함수
normalizeTree(tree)
normalizeEmotionTags(tags)
normalizeSourceUrl(url)
```

**대상 파일:**
- `js/search.js`
- `js/my-trees.js`

**난이도:** 하  
**예상 소요:** 1-2시간  
**리스크:** 낮음

---
### 후보 2: `js/utils/ui.js` 신규

**작업:**
```javascript
// 신규 파일
window.LoveBudUI = {
  showToast(message, type, duration),
  showLoading(),
  hideLoading()
};
```

**대상 파일:**
- `js/editor.js` (토스트 제거)
- `js/my-trees.js` (토스트 제거)

**난이도:** 하  
**예상 소요:** 1시간  
**리스크:** 매우 낮음

---

## 보류 후보

### 후보 3: `js/utils/date.js` 신규
- 난이도 중, 즉시 필요성 낮음
- 현재는 각 파일에서 간단히 처리 중

### 후보 4: `js/utils/media.js` 신규
- 유튜브 외 sourceType 확대 시 필요
- 현재는 youtube만 사용 중

---

## 결론

**즉시 추천:** 후보 1 (normalize 확장)  
**다음 단계:** 후보 2 (UI 유틸)

이 두 작업만으로 코드 중복이 30% 이상 감소할 것으로 예상됩니다.
