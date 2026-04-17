# LoveBud 공통 유틸 사용 정책

> **버전:** 1.0  
> **작성:** 2026-04-18  
> **목적:** 공통 유틸 사용 기준 문서화, 로컬 헬퍼 재생산 방지

---

## 1. 문서 목적

이 문서는 LoveBud 프로젝트의 공통 유틸리티(`js/utils/*.js`) 사용 정책과 적용 상태를 정의합니다.

**왜 필요한가:**
- 각 페이지 JS마다 동일한 로직이 중복되는 현상 방지
-/util별 현재 상태와今後の進むべき 방향을 명확히
-新しいローカルを 만드는前に参照すべき 기준を提供

---

## 2. Util 상태표

| Util | 파일 존재 | HTML 로드 | JS 사용 | 적용 페이지 | 상태 |
|------|----------|----------|--------|-----------|------|
| normalize.js | ✅ | 4개 페이지 | 5개 파일 | detail, my-trees, editor, search | **완료** ✅ |
| ui.js | ✅ | 3개 페이지 | 3개 파일 | search, my-trees, editor | **시범 적용** 🔄 |
| path.js | ✅ | 3개 페이지 | 4개 파일 | search, my-trees, editor | **시범 적용** 🔄 |
| media.js | ✅ | **0개 페이지** | **0개 파일** | - | **미배선** ❌ |

### 상세 설명

**normalize.js (완료)**
- HTML: detail.html, my-trees.html, editor.html, search.html
- JS 호출: detail.js, my-trees.js, editor.js, search-data-adapter.js
- 상태: 모든 페이지에서 표준 사용 중

**detail.js 적용 상태:**
- loveBudNormalize?.normalizeMemory 사용 (line 284)
-memory 정규화에 loveBudNormalize 우선
- local fallback: `window.LoveBudNormalize?.normalizeMemory || ((m) => m)`

**ui.js (시범 적용)**
- HTML: search.html, my-trees.html, editor.html
- JS 호출: my-trees.js, editor.js (모두 optional call: `LoveBudUI?.showToast`)
- 상태: 로드되지만 일부 파일에서 local fallback 함께 보유

**detail.js 적용 상태:**
- LoveBudNormalize 사용 (line 284)
- LoveBudPath 미사용 (local logic 사용 중)
- LoveBudMedia 미사용 (직접 YouTube URL 처리)

**path.js (시범 적용)**
- HTML: search.html, my-trees.html, editor.html
- JS 호출: search.js, search-card-renderer.js, search-preview-renderer.js
- 상태: 새로운 search 모듈에서 사용 시작, 기존 파일에는 local fallback 보유

**media.js (미배선 - 주의)**
- HTML: **없음** (어떤 페이지도 로드하지 않음)
- JS 호출: **없음** (어떤 파일도 사용하지 않음)
- 상태: 유틸 구현 완료, but **런타임 미연결**
- 문제: 파일은 존재하고 함수도 구현되어 있으나, HTML `<script>` 로드도, JS 호출도 없는 상태

---

## 3. 사용 규칙

### 3.1 Normalize (반드시 사용)

```javascript
// ✅ 정석: LoveBudNormalize 사용
const normalized = window.LoveBudNormalize?.normalizeMemory(mem);

// ⚠️ legacy: 각 페이지마다 인라인 보정 - 이제 만들지 말 것
const title = mem.title || mem.titles || '';
```

**適用の 대상:**
- memory 객체 정규화: `normalizeMemory(mem)`
- tree 객체 정규화: `normalizeTree(tree)`
- emotion tags 정리: `normalizeEmotionTags(tags)`

### 3.2 UI (선택 사용, 권장)

```javascript
// ✅ 권장: LoveBudUI 사용
if (window.LoveBudUI?.showToast) {
    window.LoveBudUI.showToast('메시지', 'success', 3000);
} else {
    // 🔄 legacy: local fallback (점진적으로 제거 예정)
    showToastLocal('메시지');
}
```

**適用の 대상:**
- 토스트 메시지: `showToast(message, type, duration)`
- 로딩 표시: `showLoading()` (placeholder)
-确认 다이얼로그: `showConfirm(message)`

### 3.3 Path (선택 사용, 권장)

```javascript
// ✅ 권장: LoveBudPath 사용
const basePath = window.LoveBudPath?.getBasePath() || '';

// 🔄 legacy: local fallback (점진적으로 제거 예정)
const basePath = window.location.pathname.indexOf('/pages/') !== -1 ? '' : 'pages/';
```

**適用の 대상:**
- 페이지 컨텍스트: `isPagesContext()`
- basePath 반환: `getBasePath()`
- URL 생성: `resolvePageUrl(pageName)`, `buildUrl(pageName, params)`

### 3.4 Media (아직 미사용 - 주의)

```javascript
// ⚠️ 현재: media.js가 HTML에서 로드되지 않음
// 직접 구현한 정규식 사용 중 (예: editor.js)

// ✅ 원칙: media.js가 HTML에 추가되면 LoveBudMedia 사용
const videoId = window.LoveBudMedia?.extractYouTubeId(url);
const embedUrl = window.LoveBudMedia?.getEmbedUrl(url);
```

**適用の 대상:**
- YouTube ID 추출: `extractYouTubeId(url)`
- embed URL: `getEmbedUrl(sourceUrl, type)`
- 썸네일 URL: `getThumbnailUrl(sourceUrl, type, quality)`
- URL 유효성: `validateSourceUrl(url, type)`

---

## 4. 금지 규칙

### 4.1 같은 역할 로컬 헬퍼 재생산 금지

아래 kasus는 이제 local로 다시 만들지 말 것:

|役割|既に-common化|The 作ってはいけない例|
|---|---|---|
| memory 정규화 | normalize.js | `const title = mem.title \|\| mem.titles \|\| ''` |
| tree 정규화 | normalize.js | `const treeTitle = tree?.title \|\| '나의 트리'` |
| emotionTags 정리 | normalize.js | `const tags = [...new Set(mem.emotionTags)]` |
| basePath 반환 | path.js | `const basePath = location.pathname.includes('/pages/') ? '' : 'pages/'` |
| showToast | ui.js | `function showToast(msg) { ... }` (새로 만들기) |

### 4.2media.js 미배선 주의

**현재 문제:**
- media.js 파일은 존재 (`js/utils/media.js`)
- 함수도 모두 구현 완료
- But **어떤 HTML도 로드하지 않음** → runtime에서 사용 불가

**원칙:**
- 새로운 미디어 처리 코드 만들 때
- 먼저 `pages/* .html`에 media.js 스크립트 추가 검토
- 그 후 LoveBudMedia 사용

---

## 5. 예외 규칙

아래 영역은 아직 공통화가 덜 됨 → 로컬 유지 가능 (단, 이유 문서에 남기기):

### 5.1 허용되는 예외

|영역|이유|예외 허용|
|---|---|---|
| date formatting | 공통 util 미구현 | `date.slice(0, 10).replace(/-/g, '.')` |
| sourceContext/backButton | detail.js 전용 | detail.js 내부 로직 유지 |
| Canvas 좌표 | editor 전용 | editor.js 내부 로직 유지 |
| category/stage规则 | search 전용 | search-data-adapter.js 내부 유지 |

### 5.2 문서화 요구

예외로 local 헬퍼를 만들 때:
- 주석으로 이유 기술: `// TODO: 공통화 후 제거 예정`
- 또는 이 문서에 "예외 허용" 항목에 추가 요청

---

## 6. 남은 적용 TODO

### 6.1 즉시 (이번 스프린트)

| # | 항목 | 상태 | 담당 |
|---|------|------|-------|
| 1 | media.js HTML 로드 추가 (editor.html试点) | 미배선 | - |
| 2 | editor.js의 YouTube 처리 → LoveBudMedia 통합 | 미연결 | - |
| 3 | search.js의 local getBasePath → LoveBudPath로 교체 | 진행 중 | - |

### 6.2 다음 스프린트

| # | 항목 | 상태 | 담당 |
|---|------|------|-------|
| 4 | my-trees.js의 local getBasePath → LoveBudPath로 교체 | 미진행 | - |
| 5 | detail.js의 local getBasePath → LoveBudPath로 교체 | 미진행 | - |
| 6 | my-trees.js의 local showToast → LoveBudUI로 교체 | 미진행 | - |
| 7 | search-card-renderer.js의 local getBasePath → LoveBudPath (이미 완료) | ✅ | - |
| 8 | search-preview-renderer.js의 local getBasePath → LoveBudPath (이미 완료) | ✅ | - |

### 6.3 향후 (phase 2)

| # | 항목 | 상태 | 담당 |
|---|------|------|-------|
| 9 | date.js 신규 (공통 date formatting) | 미구현 | - |
| 10 | navigation.js 신규 (sourceContext/backButton) | 미구현 | - |

---

## 7. 핵심 요약 5줄

1. **Normalize는 반드시 사용** - 모든 memory/tree 정규화에 LoveBudNormalize 우선
2. **UI/Path는 권장 사용** - local fallback 함께 있으나 점진적으로 LoveBud_*로 교체
3. **Media는 미배선 상태** - 파일은 있으나 HTML 로드 안 됨, 새로운 미디어処理作るとき integration 검토
4. **동일 역할 local 헬퍼 재생산 금지** - 이�� common화된 영역은 다시 만들지 말 것
5. **예외는 문서화 필수** -止むを得ない理由で로컬維持する場合 주석 또는 이 문서에 이유记载

---

## 8. 문서 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-04-18 | 초기 작성 |