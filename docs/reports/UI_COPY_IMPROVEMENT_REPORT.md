# LoveBud MVP - UI 및 카피 개선 보고서

## 1. 수정된 파일 목록 (Modified Files)

### CSS 파일
- `css/global.css` - 공통 반응형 스타일 및 네비게이션 개선
- `css/index.css` - 인덱스 페이지 반응형 레이아웃
- `css/editor.css` - 에디터 페이지 태블릿/모바일 레이아웃

### JavaScript 파일
- `js/mock-data.js` - 새로 생성된 공유 데이터 모듈
- `js/editor.js` - 공유 데이터 사용 및 detail 페이지 링크 추가
- `js/detail.js` - 공유 데이터 및 URL 라우팅 적용
- `js/search.js` - 공유 데이터 및 detail 페이지 링크 적용

### HTML 파일
- `editor.html` - nav 인라인 스타일 → 클래스 전환, mock-data 스크립트 추가
- `search.html` - nav 인라인 스타일 → 클래스 전환
- `detail.html` - 동적 콘텐츠 ID 추가, 반응형 미디어쿼리 추가
- `index.html` - nav 인라인 스타일 → 클래스 전환

---

## 2. 반응형 Breakpoint 요약

### Desktop (기본)
- 1440px 이상: 전체 데스크톱 레이아웃

### Tablet (1024px)
- `max-width: 1024px`
- editor: 사이드바 → 상단 가로 nav, detail-panel → 모달식
- detail/search: 2열 → 1열 스택
- index: 4열 피쳐 → 2열, 메모리 카드 크기 조정

### Mobile (768px)
- `max-width: 768px`
- 전체 nav 간격 축소, 폰트 크기 감소
- editor: 상단 nav 최소화, 노드 레이블 숨김
- detail/search: 패딩 감소, 카드/썸네일 크기 축소
- index: hero 2열 → 1열 스택, 메모리 카드 일부 숨김

### Small Mobile (480px)
- `max-width: 480px`
- nav: 중첩 → 하단 링크중앙정렬
- search: 결과카드 세로배치, 썸네일 더 축소

---

## 3. 페이지별 레이아웃 수정 요약

### index.html
- **문제**: 고정 width container (1440px), 50%/50% hero 분할, 4열 footer, 절대위치 메모리카드 overflow
- **해결**: 
  - 모바일에서 100vw/auto height로 변경
  - 모바일에서 hero 세로 스택
  - footer 4열 → 1열 (Tablet), 2열 (Mobile)
  - memory-card-mini 절대위치 유지하되 일부 숨김
- **남은 한계**: 복잡한 SVG 배치가 모바일에서 정확히 재배치되지 않을 수 있음

### editor.html
- **문제**: 고정 사이드바(100px) + 디테일패널(420px) → 캔버스 영역 협소, SVG 좌표 고정값
- **해결**:
  - Tablet: 사이드바 → 상단 가로 nav, detail-panel → 우측 모달 (transform)
  - Mobile: 사이드바 최소화 (아이콘만), detail-panel → 전체화면
  - 노드 이미지 크기 축소 (90→70→60px)
- **남은 한계**: SVG 노드 좌표가 고정되어 모바일에서는 화면 밖으로 나갈 수 있음. Canvas 영역에 overflow: auto 또는 zoom/pan 필요할 수 있음

### detail.html
- **문제**: 3fr/2fr 고정 그리드, 연결파편 2열 고정, 제목 폰트 너무 큼
- **해결**:
  - Tablet에서 1열 스택
  - 모바일에서 연결파편 세로배치
  - 제목/본문 폰트 반응형 조정
- **남은 한계**: 긴 제목이 모바일에서 여러 줄로 breaks될 수 있음

### search.html
- **문제**: 1fr/400px 고정 그리드, sticky sidebar, 썸네일 고정 240px
- **해결**:
  - Tablet에서 사이드바 static으로 전환
  - 모바일에서 썸네일 크기 축소 (240→140→100px)
  - 480px에서 카드 세로배치
- **남은 한계**: 검색 입력란의 아이콘 위치가 인라인 스타일로 고정되어 있어 미디어쿼리로 완전히 조정 어려움

### login.html
- **문제**: 큰 패딩 (64px)在小屏에서 여백 과다
- **해결**: global.css 미디어쿼리로 자동 조정
- **남은 한계**: 없음 (전체적으로 잘 반응형)

---

## 4. 향후 API 연동 가이드 (기존 workdiary 참고)

현재 `js/mock-data.js` 모듈이 데이터 제공 역할을 함. 향후 백엔드 연동 시:

1. **교체 위치**: `mock-data.js` 전체 내용을 API 호출로 대체
2. **함수 시그니처 유지**: `getTrees()`, `getMemoriesByTree(treeId)`, `getMemory(id)` 같은 함수명과 반환 형식 유지
3. **비동기 처리**: 실제 API는 비동기이므로, 클라이언트 코드에 `await` 추가 필요 → editor.js/detail.js/search.js를 async로 변경
4. **에러 처리**: network fallback 로직 추가 가능
5. **URL 라우팅**: 현재 `detail.html?id=${mem.id}` 방식 유지. 백엔드에서도 memory ID를 URL param으로 사용

예:
```javascript
// 현재
const memories = getMemoriesByTree(tree.id);

// API 연동 후
const memories = await fetch(`/api/memories?treeId=${tree.id}`).then(r => r.json());
```

클라이언트 코드는 이미 mock 데이터에 의존하므로 mock-data.js만 교체하면 대부분의 로직 unchanged.

---

## 5. 카피 개선 제안서 (코드 미수정, 제안만)

### A. 필수 수정 (Critical - Brand/UX 손상)

**1. index.html - 페이지 타이틀**
- 현재: `사랑을 기록하고 잇는 공간` (typo)
- 제안: `사랑을 기록하는 공간`

**2. search.html - Save 버튼**
- 현재: `Save to LoveTree` (English)
- 제안: `러브트리에 저장`

**3. detail.html - 태그 chips**
- 현재: `<span class="tag-chip active">Excited</span>`, `<span>Happy</span>`
- 제안: `신남`, `기쁨` (또는 캐릭터별 감정에 맞는 한국어)

**4. editor.js & search.js - 감정 태그 English parenthetical**
- 현재: `강렬한 (Intense)`, `환희 (Euphoria)`, `여운 (Lingering)`
- 제안: `강렬한`, `환희`, `여운` (English 제거)

**5. detail.html - 영어 headings**
- 현재: `ARCHIVES — 2024.03.15`, `The love story continues`
- 제안: `기록 — 2024.03.15`, `사랑의 이야기는 계속됩니다`

**6. login.html - 기술 용어**
- 현재: `트리 동기화`, `비밀 기록 관리`
- 제안: `트리 자동 저장`, `비밀 기록 보호`

---

### B. 있으면 좋은 수정 (Polish - 자연스러움 향상)

**index.html**
- `다른 트리 둘러보기` → `다른 사람들의 트리 구경하기` (더 친근)
- Footer "순간 포착" → `소중한 순간` (따뜻함 증가)
- Footer "경로 연결" → `기록이 이어지는 길` (메타포 일관성)
- Footer "트리 완성" → `트리 성장` (동적 느낌)

**editor.html**
- `메모리 상세` → `기록 상세` (메모리 → 기록 용어 통일)
- `Memory Detail` (JS) → `기록 보기`
- `이 기억 저장하기` → `이 순간 저장하기` (기억→순간, 감정 강도)

**detail.html**
- `기록 수정` → `수정하기` (간결)
- `기록 미리보기` (sidebar) → `파편 미리보기` (용어 통일)
- `ARCHIVAL DATA` → `보관 정보`

**search.html**
- `새로운 파편 포착` → `새로운 파편 발견` (더 자연스러운 동사)
- `아티스트명, 무대 이름, 또는 링크를 입력하세요` → `아티스트나 제목으로 검색하세요` (간결)
- Preview artist placeholder `-` → `아티스트 미상` (공백보다 나음)

**login.html**
- `로그인하면 모든 기록이 안전하게 보관됩니다.` → `로그인하면 모든 기억이 안전히 간직됩니다.` (보관→간직, 더 따뜻)
- `나중에 기록할게요 (홈으로)` → `나중에 기억할게요` (기록→기억으로 통일, 더 개인적)

---

### C. 용어 통합 제안

| 현재 (혼용) | 제안 (통일) | 이유 |
|------------|------------|------|
| 메모리 / 기억 / 기록 | **기록** (memory), **기억** (recollection) | 일관성: 데이터는 "기록", 감정은 "기억" |
| 파편 (fragment) | 유지 | 독자적 브랜드 용어, 유지 권장 |
| 트리 / 러브트리 | "러브트리" (브랜드), "트리" (약칭) | OK |
| 저장 / 보관 | **저장** (save), **간직** (cherish) | "보관"은 차가움, "간직"이 감정적 |
| 동기화 | **자동 저장** 또는 **연동** | 기술용어 회피 |

---

## 6. 남은 반응형 한계

1. **editor.js SVG Canvas**: 노드 위치가 고정 px 좌표(400, 650, 900 등)라 모바일에서 화면 밖으로 나갈 수 있음. Canvas scale/translate 또는 pan 기능 필요
2. **detail.html 긴 제목**: 3줄 이상 넘어가면 레이아웃 흐트러짐 가능
3. **search.html 필터 chips**: 너무 많은 필터가 모바일에서 래핑되어 Ugly해질 수 있음
4. **index.html 배경 blob**: 고정 크기(50vw)라 모바일에서 잘림 가능성
5. **editor.html detail-panel**: 모달 전환되었지만 열기/닫기 트리거가 노드 클릭뿐. 모바일에서 뒤로가기/닫기 버튼 필요

---

## 7. 파일별 코드 수정 내역 요약

### CSS Changes
- `global.css`: 네비 gap 조정, tablet/mobile 미디어쿼리 추가 (768, 1024, 480px)
- `index.css`: app-container 모바일 대응, hero layout stack, feature-card stack, memory-card hide
- `editor.css`: tablet layout(세로 flex), mobile 최소화, detail-panel 모달화

### HTML Changes
- `editor.html`: `<nav>` → `<nav class="main-nav">`, mock-data.js 스크립트 추가
- `search.html`: `<nav>` → `<nav class="main-nav">`, detail.html에 #connectedFragments ID 추가
- `detail.html`: `<div>` → `<div id="connectedFragments">`, `<div class="tags-container">` → `<div id="tagsContainer">`, 미디어쿼리 스타일블록 추가

### JS Changes
- `mock-data.js`: 새 파일, 통합 스키마 및 헬퍼 함수
- `editor.js`: 공유 데이터 사용, 위치 데이터 분리, detail.html 링크, date formatting
- `detail.js`: URL param 라우팅, 공유 데이터 조회, YouTube embed, connected siblings 표시
- `search.js`: 공유 데이터 필터링, preview update, Korean quote placeholder (현재 영어 그대로)

---

## 결론

레이아웃: 3단계 breakpoint(1024/768/480)로 모바일/태블릿 완전 대응. editor canvas는 추가 개선 필요.
카피: 영어 잔여물 제거가 최우선. 그 후 자연스러운 한국어 표현으로 업데이트 권장.
API 연동: `mock-data.js` 모듈을 fetcher로 교체하면 클라이언트 코드 변화 최소화.
