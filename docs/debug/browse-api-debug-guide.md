# LoveBud 둘러보기 API 디버깅 가이드

## 현재 전제

- browse 프론트 필터 문제는 이미 해결됨 (GitHub main 기준)
- 둘러보기는 `/community/trees`와 `/community/memories`를 각각 받아 합침
- 최종 매칭은 `treeId` 기준으로 이뤄짐

즉 이제 확인할 건 **API 응답에 실제 public 데이터가 들어오는지**입니다.

---

## 1) 브라우저 콘솔 확인 코드

### 빠른 시작

```javascript
// 전체 진단 한번에 실행
BrowseAPIDebugger.runFullDiagnostic()

// 또는 개별 실행
BrowseAPIDebugger.checkBasic()      // 기본 API 응답
BrowseAPIDebugger.checkMatching()   // 트리-메모리 매칭
BrowseAPIDebugger.checkTreeById('YOUR_TREE_ID')  // 특정 트리
```

### 스크립트 로드

`scripts/debug-browse-api.js`를 둘러보기 페이지에서 로드:

```javascript
const script = document.createElement('script');
script.src = '/scripts/debug-browse-api.js';
document.head.appendChild(script);
```

또는 DevTools Console에 내용 직접 복사-붙여넣기

---

## 2) curl 확인 예시

### 공개 트리 확인

```bash
curl -i "https://YOUR_DOMAIN/api/community/trees"
```

### 공개 순간 확인

```bash
curl -i "https://YOUR_DOMAIN/api/community/memories"
```

### jq로 보기 좋게 확인

```bash
# 트리 요약
curl -s "https://YOUR_DOMAIN/api/community/trees" \
| jq '[.[] | {id: (.id // .data.id), title: (.title // .data.title), visibility: (.visibility // .data.visibility)}]'

# 메모리 요약 (treeId 기준)
curl -s "https://YOUR_DOMAIN/api/community/memories" \
| jq '[.[] | {id: (.id // .data.id), treeId: (.treeId // .tree_id // .data.treeId // .data.tree_id), visibility: (.visibility // .data.visibility)}]'
```

---

## 3) PowerShell 스크립트 사용 (Windows)

```powershell
# 기본 실행
.\scripts\debug-browse-api.ps1

# 특정 도메인 지정
.\scripts\debug-browse-api.ps1 -Domain "https://lovebud.netlify.app"
```

출력:
- API 응답 상태 및 데이터 수
- 트리별 메모리 매칭 수
- 고립 메모리 (존재하지 않는 treeId 참조) 경고
- `debug-logs/` 폴더에 JSON 저장

---

## 4) Bash 스크립트 사용 (Mac/Linux)

```bash
# 실행 권한 부여
chmod +x scripts/debug-browse-api.sh

# 실행
./scripts/debug-browse-api.sh

# 또는 도메인 지정
./scripts/debug-browse-api.sh https://lovebud.netlify.app
```

---

## 5) 확인 결과 해석 기준

### 정상

- `/api/community/trees`에 public tree가 있음
- `/api/community/memories`에 그 tree id를 가리키는 memory가 있음
- 둘 다 200 응답

### 이상 (원인별)

| 증상 | 가능한 원인 | 확인 방법 |
|------|------------|----------|
| trees에는 있는데 memories에 해당 `treeId`가 없음 | DB의 `memories.tree_id` 또는 visibility 문제 | DB SQL로 `tree_id`, `visibility` 확인 |
| DB에는 public인데 API 응답에는 없음 | Netlify function 쿼리/배포/캐시 문제 | 함수 로그 확인, 재배포 |
| 둘 다 응답은 오는데 browse 화면은 비어 있음 | `search.js` 렌더 경로 문제 | `public-tree-adapter.js` 수정 확인 |

---

## 6) DB 확인 SQL

### 공개 트리 확인

```sql
SELECT id, title, visibility, created_at 
FROM trees 
WHERE visibility = 'public'
ORDER BY created_at DESC;
```

### 공개 트리별 공개 메모리 수 확인

```sql
SELECT 
  t.id AS tree_id,
  t.title,
  COUNT(m.id) AS public_memory_count
FROM trees t
LEFT JOIN memories m 
  ON m.tree_id = t.id 
  AND m.visibility = 'public'
WHERE t.visibility = 'public'
GROUP BY t.id, t.title
ORDER BY t.created_at DESC;
```

### 트리/메모리 공개 상태 불일치 확인

```sql
SELECT 
  t.id AS tree_id,
  t.title AS tree_title,
  t.visibility AS tree_visibility,
  m.id AS memory_id,
  m.title AS memory_title,
  m.visibility AS memory_visibility
FROM trees t
JOIN memories m ON m.tree_id = t.id
WHERE t.visibility = 'public'
  AND m.visibility != 'public'
ORDER BY t.created_at DESC, m.created_at DESC;
```

### 전체 공개로 변경

```sql
UPDATE trees 
SET visibility = 'public', updated_at = NOW() 
WHERE visibility IS DISTINCT FROM 'public';

UPDATE memories 
SET visibility = 'public', updated_at = NOW() 
WHERE visibility IS DISTINCT FROM 'public';
```

---

## 7) 로컬 작업용 프롬프트

```
LoveBud community browse API 응답 누락 문제를 점검하자.

원칙:
- 현재 GitHub main 기준
- 이미 js/api/public-tree-adapter.js의 0-memory public tree 허용 수정은 반영된 상태
- 이번 작업은 코드 변경보다 API 응답 검증이 우선
- 추정하지 말고 /api/community/trees, /api/community/memories 실제 응답 기준으로 판단
- 필요 시 최소 수정만 제안
- 설명보다 확인 포인트와 붙여넣을 코드 먼저 줄 것

점검 목표:
1. /api/community/trees가 public tree를 실제 반환하는지 확인
2. /api/community/memories가 해당 treeId의 memory를 실제 반환하는지 확인
3. treeId/tree_id 정합성 확인
4. DB 문제 / API 문제 / 프론트 문제 중 어디인지 구분
5. 수정이 필요하면 최소 수정 코드만 제안

원하는 응답 형식:
1. 원인 후보 우선순위
2. 브라우저 콘솔 코드
3. curl 예시
4. 필요한 경우 붙여넣을 코드
5. 커밋 메시지
```

---

## 체크리스트

- [ ] 브라우저 콘솔에서 `community/trees`, `community/memories` 응답 확인
- [ ] 특정 `treeId`가 두 응답에 모두 있는지 확인
- [ ] 없으면 DB SQL로 `trees.visibility`, `memories.visibility`, `tree_id` 확인
- [ ] 둘 다 맞는데도 안 보이면 `search.js` 렌더 경로 점검
- [ ] `js/api/public-tree-adapter.js` 수정이 실제 배포되었는지 확인
