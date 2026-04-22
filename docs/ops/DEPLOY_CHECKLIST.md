# LoveBud 배포 체크리스트 (Vercel & Modal 중심)

이 문서는 현재 운영 기준인 **Modal > Vercel > Netlify** 구조에서 배포 전후 확인 항목을 정리합니다.

- 실서비스 프론트 주소: `https://lovebud.vercel.app/`
- 브라우저 API 기준: same-origin `/api/...`
- Netlify 역할: browse summary fallback 또는 일부 upstream fallback

## 0. 빠른 엔드포인트 검증 (1분)

```bash
# same-origin browse summary 경로 확인
curl -s -o /dev/null -w "%{http_code}" "https://lovebud.vercel.app/api/community/trees?view=summary&sort=latest&limit=3"
# 기대: 200
```

추가 점검:
- 응답이 200이어도 Modal 직응답인지 Netlify fallback인지는 Vercel 로그로 함께 확인합니다.
- browse summary는 display filter이고, publication guard와 혼동하지 않습니다.

## 1. Firebase Authorized Domains 점검

Firebase Console > Authentication > Settings > Authorized Domains에서 아래 도메인을 확인합니다.

- [ ] `lovebud.vercel.app` (Primary)
- [ ] `lovebud.netlify.app` (Fallback / legacy)
- [ ] `localhost`
- [ ] `127.0.0.1`

## 2. 환경 변수 동기화 (Vercel Dashboard)

Vercel 프로젝트에 아래 환경 변수가 설정되어 있어야 합니다.

- [ ] `MODAL_BASE_URL`
- [ ] `NETLIFY_API_BASE_URL`
- [ ] `DATABASE_URL`
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON`

설명:
- `MODAL_BASE_URL`: browse summary read path의 1순위 upstream
- `NETLIFY_API_BASE_URL`: Vercel `/api` route의 fallback / upstream 대상

## 3. 배포 후 핵심 플로우 확인

| 플로우 | URL | 확인 사항 |
| :--- | :--- | :--- |
| 홈 | `/` | 정상 로드 |
| 둘러보기 | `/search.html` | `/api/community/trees?view=summary&sort=latest&limit=3` 성공, 카드/preview 정상 렌더 |
| 로그인 | `/login.html` | Vercel 도메인에서 인증 성공 여부 |
| 에디터 | `/editor.html` | 저장 및 visibility 전환 정합성 |

## 4. 장애 대응 우선순위

1. **Vercel `/api/community/trees` 실패**
   - Vercel 로그에서 `api/community/trees.js` 오류 확인
   - `MODAL_BASE_URL`, `NETLIFY_API_BASE_URL` 환경 변수 확인

2. **Auth Domain Error**
   - Firebase Console 승인 도메인 확인

3. **Modal Timeout**
   - `api/community/trees.js`는 summary 요청에서 Modal을 먼저 시도하고, 실패 시 Netlify fallback으로 내려갑니다.
   - 즉 전체 browse 차단이 아니라 성능 저하 가능성으로 해석합니다.

4. **Netlify Usage Exceeded / Upstream 장애**
   - `NETLIFY_API_BASE_URL` 대상 상태 확인
   - fallback 계층이므로 browse summary 또는 hydrate 일부에 영향 가능

## 5. 검증 메모

- browse display filter는 **무엇을 보여줄지**에 대한 read/display 기준입니다.
- publication guard는 **무엇을 public으로 전환할 수 있는지**에 대한 write 정책입니다.
- 배포 체크 시 두 개념을 같은 항목으로 보고하지 않습니다.
