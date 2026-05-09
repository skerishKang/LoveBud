# LoveBud 수동 테스트 체크리스트

> **버전:** 1.0  
> **생성일:** 2026-04-18  
> **대상:** 3a34e87 후속 보강 작업 검증

---

## 테스트 개요

| 항목 | 내용 |
|------|------|
| **테스트 목적** | 공통 유틸 로드 및 fallback 동작 검증 |
| **테스트 대상** | editor.html, my-trees.html, search.html |
| **핵심 유틸** | LoveBudNormalize, LoveBudUI, LoveBudPath |

---

## 사전 준비

```bash
# 로컬 서버 실행 (예시)
cd G:\Ddrive\BatangD\task\workdiary\LoveBud
python -m http.server 8080
# 또는
npx serve .
```

**브라우저:** Chrome DevTools Console 열고 테스트

---

## 테스트 시나리오

### 1. my-trees 진입 테스트

| 단계 | 동작 | 예상 결과 | 통과 |
|------|------|-----------|------|
| 1 | `/pages/my-trees.html` 접속 | 페이지 로드 | [ ] |
| 2 | DevTools Console 확인 | `[LoveBudNormalize] Loaded` 로그 확인 | [ ] |
| 3 | | `[LoveBudUI] UI utilities loaded` 로그 확인 | [ ] |
| 4 | | `[LoveBudPath] Path utilities loaded` 로그 확인 | [ ] |
| 5 | | **경고 없음** (console.warn 없어야 함) | [ ] |
| 6 | 트리 카드 렌더링 확인 | 카드 정상 표시 | [ ] |
| 7 | 카드 클릭 → editor 이동 | `editor.html?treeId=xxx`로 이동 | [ ] |

**Fallback 테스트 (개발용):**
```javascript
// Console에서 실행
window.LoveBudNormalize = undefined;
// 페이지 새로고침 → console.warn '[my-trees] LoveBudNormalize not loaded...' 확인
```

---

### 2. search 진입 테스트

| 단계 | 동작 | 예상 결과 | 통과 |
|------|------|-----------|------|
| 1 | `/pages/search.html` 접속 | 페이지 로드 | [ ] |
| 2 | DevTools Console 확인 | 3개 유틸 로그 확인 | [ ] |
| 3 | | **경고 없음** | [ ] |
| 4 | 트리 카드 렌더링 | 카드 정상 표시 | [ ] |
| 5 | 감정 태그 표시 | 태그 정상 표시 | [ ] |
| 6 | 카드 클릭 → detail 이동 | `detail.html?id=xxx`로 이동 | [ ] |

---

### 3. editor 진입 테스트

| 단계 | 동작 | 예상 결과 | 통과 |
|------|------|-----------|------|
| 1 | `/pages/editor.html?treeId=xxx` 접속 | 페이지 로드 | [ ] |
| 2 | DevTools Console 확인 | 3개 유틸 로그 확인 | [ ] |
| 3 | | **경고 없음** | [ ] |
| 4 | 트리 노드 렌더링 | 노드 정상 표시 | [ ] |
| 5 | 상세 패널 확인 | 패널 정상 표시 | [ ] |

---

### 4. Toast 발생 테스트

| 단계 | 동작 | 예상 결과 | 통과 |
|------|------|-----------|------|
| 1 | my-trees → "새 러브트리 만들기" 클릭 | Toast 또는 리다이렉트 | [ ] |
| 2 | editor → "영상 추가" → 저장 | 저장 성공 Toast | [ ] |
| 3 | Console 확인 | `[Toast success]` 로그 확인 | [ ] |

---

### 5. Path Util 적용 경로 이동 테스트

| 단계 | 동작 | 예상 결과 | 통과 |
|------|------|-----------|------|
| 1 | search 페이지에서 트리 카드 클릭 | detail.html로 정상 이동 | [ ] |
| 2 | URL 확인 | `pages/detail.html?id=xxx` 형태 | [ ] |
| 3 | 404 오류 없음 | 페이지 정상 로드 | [ ] |

---

### 6. Normalize 기반 트리 카드 렌더 테스트

| 단계 | 동작 | 예상 결과 | 통과 |
|------|------|-----------|------|
| 1 | my-trees 페이지 로드 | 트리 카드 정상 표시 | [ ] |
| 2 | 카드 내용 확인 | 제목, 날짜, visibility 표시 | [ ] |
| 3 | Console 확인 | `[my-trees] Rendering X trees` 로그 | [ ] |
| 4 | | **normalize 관련 경고 없음** | [ ] |

---

## 문제 발견 시 체크사항

### Console 경고 발생 시

```
[my-trees] LoveBudNormalize not loaded, using local fallback
```
→ **원인:** HTML에서 `normalize.js` 로드 누락
→ **해결:** `my-trees.html`에 `<script src="../js/utils/normalize.js">` 추가

```
[search] LoveBudPath not loaded, using local fallback
```
→ **원인:** HTML에서 `path.js` 로드 누락
→ **해결:** `search.html`에 `<script src="../js/utils/path.js">` 추가

```
[editor] LoveBudUI not loaded, toast degraded to console
```
→ **원인:** HTML에서 `ui.js` 로드 누락
→ **해결:** `editor.html`에 `<script src="../js/utils/ui.js">` 추가

---

## 회귀 테스트 (기존 기능)

| 기능 | 테스트 방법 | 예상 결과 |
|------|-------------|-----------|
| 인증 플로우 | 로그인 → my-trees 진입 | 정상 접속 |
| 트리 생성 | "새 러브트리 만들기" 클릭 | editor로 이동 |
| 메모리 추가 | editor → "영상 추가" | 노드 생성됨 |
| 캐시 동작 | 페이지 새로고침 | 이전 데이터 즉시 표시 |

---

## 테스트 완료 정의

- [ ] 모든 시나리오 통과
- [ ] Console에 오류/경고 없음
- [ ] 기존 기능 정상 작동
- [ ] 문서 업데이트 완료

---

## 비고

- 이 체크리스트는 `3a34e87` 커밋 후속 보강 작업 검증용
- 브라우저: Chrome 권장
- 테스트 환경: 로컬 서버 (http://localhost:8080)
