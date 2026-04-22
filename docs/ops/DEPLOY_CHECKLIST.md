# LoveBud 배포 체크리스트

이 문서는 현재 운영 기준인 **Modal > Vercel > Netlify** 구조에서 배포 전후 확인 항목을 정리합니다.

- 공식 서비스 주소: `https://lovebud.vercel.app/`
- 브라우저 API 기준: same-origin `/api/...`
- Netlify 역할: fallback / legacy

## 0. 빠른 엔드포인트 검증 (1분)

```bash
# same-origin browse summary 경로 확인
curl -s -o /dev/null -w "%{http_code}" "https://lovebud.vercel.app/api/community/trees?view=summary&sort=latest&limit=3"
# 기대: 200

# same-origin preview hydrate 경로 확인
curl -s -o /dev/null -w "%{http_code}" "https://lovebud.vercel.app/api/community/memories?treeId=<treeId>"
# 기대: 200
```

추가 점검:

```bash
curl -s "https://<MODAL_BASE_URL>/modal/health"
curl -s "https://<MODAL_BASE_URL>/modal/browse/latest?limit=3"
```

주의:
- browse summary는 Modal 우선 read path입니다.
- preview hydrate도 representative preview 기준으로 Modal 우선 시도를 가집니다.
- Netlify는 fallback 입니다.
- browse display filter와 publication guard를 혼동하지 않습니다.

## 1. Firebase Authorized Domains 점검

Firebase Console > Authentication > Settings > Authorized Domains

- [ ] `lovebud.vercel.app`
- [ ] `lovebud.netlify.app`
- [ ] `localhost`
- [ ] `127.0.0.1`

## 2. Vercel 환경 변수

아래 값이 Vercel에 설정되어 있어야 합니다.

- [ ] `MODAL_BASE_URL`
- [ ] `NETLIFY_API_BASE_URL`
- [ ] `LOVEBUD_UPSTREAM_API_BASE`

권장값 메모:
- `NETLIFY_API_BASE_URL=https://lovebud.netlify.app/api`
- `LOVEBUD_UPSTREAM_API_BASE=https://lovebud.netlify.app/api`
- `MODAL_BASE_URL=https://<live-modal-domain>`

설명:
- `MODAL_BASE_URL`: browse summary와 preview representative의 1순위 upstream
- `NETLIFY_API_BASE_URL`: `/api/community/trees`, `/api/community/memories` fallback / upstream 대상
- `LOVEBUD_UPSTREAM_API_BASE`: catch-all `/api/*` upstream base

## 3. Modal 환경 변수 / secret

- [ ] `DATABASE_URL`가 Modal secret `lovebud-db`로 주입되는지 확인
- [ ] `CORS_ALLOWED_ORIGINS`가 필요 시 운영값으로 설정되어 있는지 확인
- [ ] `/modal/health` 200 확인
- [ ] `/modal/browse/latest?limit=3` 배열 응답 확인

## 4. 배포 후 핵심 플로우 확인

| 플로우 | URL | 확인 사항 |
| :--- | :--- | :--- |
| 홈 | `https://lovebud.vercel.app/` | 정상 로드 |
| 둘러보기 | `https://lovebud.vercel.app/search.html` | summary 카드 정상 로드 |
| browse api | `/api/community/trees?view=summary&sort=latest&limit=3` | 200 + JSON |
| preview hydrate | `/api/community/memories?treeId=<id>` | 200 + JSON |
| 로그인 | `https://lovebud.vercel.app/login.html` | Firebase 도메인 오류 없음 |
| 에디터 | `https://lovebud.vercel.app/editor.html` | 기본 진입 정상 |

## 5. fallback 점검

- [ ] Modal 차단 시 browse summary가 Netlify fallback으로 계속 응답하는지 확인
- [ ] preview representative를 Modal에서 만들 수 없을 때 `api/community/memories.js`가 Netlify upstream으로 정상 응답하는지 확인
- [ ] catch-all `/api/*`가 `LOVEBUD_UPSTREAM_API_BASE` 기준으로 정상 proxy 되는지 확인

## 6. 장애 대응 우선순위

1. **Vercel `/api/community/trees` 실패**
   - Vercel 로그에서 `api/community/trees.js` 오류 확인
   - `MODAL_BASE_URL`, `NETLIFY_API_BASE_URL` 확인

2. **Vercel `/api/community/memories` 실패**
   - `MODAL_BASE_URL` 확인
   - representative preview 생성 여부 확인
   - `NETLIFY_API_BASE_URL` 확인

3. **Modal Timeout / Modal 장애**
   - `/modal/health` 와 `/modal/browse/latest?limit=3` 확인
   - Modal 실패 시 Netlify fallback으로 계속 응답하는지 확인

4. **Netlify Upstream 장애**
   - `NETLIFY_API_BASE_URL` 대상 상태 확인
   - `LOVEBUD_UPSTREAM_API_BASE` 대상 상태 확인
   - fallback 계층이므로 browse summary 또는 hydrate 일부에 영향 가능

5. **Auth Domain Error**
   - Firebase Console 승인 도메인 확인

## 7. 오래된 설명 제거 기준

배포/운영 문서에서 아래 표현은 사용하지 않습니다.

- `lovebud.netlify.app`를 주서비스처럼 설명하는 문장
- Netlify를 primary runtime으로 설명하는 문장
- Vercel을 단순 정적 호스팅만 하는 것처럼 설명하는 문장
- preview hydrate가 Netlify only 경로라고 단정하는 문장

현재 기준 문장:
- **공식 주소는 Vercel**
- **browse summary의 1순위는 Modal**
- **preview hydrate도 Modal representative preview를 먼저 시도하고, 필요 시 Netlify fallback을 탄다**
- **Netlify는 fallback / legacy**
