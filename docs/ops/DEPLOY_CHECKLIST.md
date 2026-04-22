# LoveBud 배포 체크리스트

이 문서는 현재 운영 기준인 **Modal > Cloudflare Pages > Vercel > Netlify** 구조에서 배포 전후 확인 항목을 정리합니다.

- 공식 서비스 주소: `https://lovebud.pages.dev/`
- 브라우저 API 기준: same-origin `/api/...`
- Vercel 역할: upstream / secondary entry
- Netlify 역할: fallback / legacy

## 0. 빠른 엔드포인트 검증 (1분)

```bash
# same-origin browse summary 경로 확인
curl -s -o /dev/null -w "%{http_code}" "https://lovebud.pages.dev/api/community/trees?view=summary&sort=latest&limit=3"
# 기대: 200

# same-origin preview hydrate 경로 확인
curl -s -o /dev/null -w "%{http_code}" "https://lovebud.pages.dev/api/community/memories?treeId=<treeId>"
# 기대: 200
```

추가 점검:

```bash
curl -s "https://<MODAL_BASE_URL>/modal/health"
curl -s "https://<MODAL_BASE_URL>/modal/browse/latest?limit=3"
```

주의:
- browse summary는 Modal 우선 read path입니다.
- preview hydrate도 Modal 우선 시도를 가집니다.
- Cloudflare Pages가 공식 사용자-facing entry입니다.
- Vercel / Netlify는 보조 계층입니다.
- browse display filter와 publication guard를 혼동하지 않습니다.

## 1. Firebase Authorized Domains 점검

Firebase Console > Authentication > Settings > Authorized Domains

- [ ] `lovebud.pages.dev`
- [ ] `lovebud.vercel.app`
- [ ] `lovebud.netlify.app`
- [ ] `localhost`
- [ ] `127.0.0.1`

## 2. Cloudflare Pages 환경 변수

아래 값이 Cloudflare Pages에 설정되어 있어야 합니다.

- [ ] `MODAL_BASE_URL`
- [ ] `LOVEBUD_UPSTREAM_ORIGIN`

권장값 메모:
- `LOVEBUD_UPSTREAM_ORIGIN=https://lovebud.vercel.app`
- `MODAL_BASE_URL=https://<live-modal-domain>`

설명:
- `MODAL_BASE_URL`: browse summary와 private/community read의 1순위 upstream
- `LOVEBUD_UPSTREAM_ORIGIN`: catch-all fallback upstream origin

## 3. Modal 환경 변수 / secret

- [ ] `DATABASE_URL`가 Modal secret `lovebud-db`로 주입되는지 확인
- [ ] `CORS_ALLOWED_ORIGINS`가 필요 시 운영값으로 설정되어 있는지 확인
- [ ] `/modal/health` 200 확인
- [ ] `/modal/browse/latest?limit=3` 배열 응답 확인

## 4. 배포 후 핵심 플로우 확인

| 플로우 | URL | 확인 사항 |
| :--- | :--- | :--- |
| 홈 | `https://lovebud.pages.dev/` | 정상 로드 |
| 둘러보기 | `https://lovebud.pages.dev/search.html` | summary 카드 정상 로드 |
| browse api | `/api/community/trees?view=summary&sort=latest&limit=3` | 200 + JSON |
| preview hydrate | `/api/community/memories?treeId=<id>` | 200 + JSON |
| 로그인 | `https://lovebud.pages.dev/login.html` | Firebase 도메인 오류 없음 |
| 에디터 | `https://lovebud.pages.dev/editor.html` | 기본 진입 정상 |

## 5. fallback 점검

- [ ] Modal 차단 시 browse summary가 Vercel upstream fallback으로 계속 응답하는지 확인
- [ ] catch-all `/api/*`가 `LOVEBUD_UPSTREAM_ORIGIN` 기준으로 정상 proxy 되는지 확인
- [ ] Netlify legacy 계층이 필요한 경로에서만 보조적으로 관여하는지 확인

## 6. 장애 대응 우선순위

1. **Cloudflare Pages `/api/community/trees` 실패**
   - Pages function 로그 확인
   - `MODAL_BASE_URL`, `LOVEBUD_UPSTREAM_ORIGIN` 확인

2. **Cloudflare Pages `/api/community/memories` 실패**
   - `MODAL_BASE_URL` 확인
   - representative preview 생성 여부 확인
   - Vercel upstream fallback 확인

3. **Modal Timeout / Modal 장애**
   - `/modal/health` 와 `/modal/browse/latest?limit=3` 확인
   - Modal 실패 시 Vercel fallback으로 계속 응답하는지 확인

4. **Vercel Upstream 장애**
   - `LOVEBUD_UPSTREAM_ORIGIN` 대상 상태 확인
   - Pages 로그 확인
   - fallback 계층이므로 일부 경로에 영향 가능

5. **Auth Domain Error**
   - Firebase Console 승인 도메인 확인

## 7. 오래된 설명 제거 기준

배포/운영 문서에서 아래 표현은 사용하지 않습니다.

- `lovebud.vercel.app`를 공식 사용자-facing 주소처럼 설명하는 문장
- `lovebud.netlify.app`를 주서비스처럼 설명하는 문장
- Netlify를 primary runtime으로 설명하는 문장
- Cloudflare Pages를 무시하고 Vercel을 공식 진입점으로 단정하는 문장

현재 기준 문장:
- **공식 주소는 Cloudflare Pages (`pages.dev`)**
- **browse summary의 1순위는 Modal**
- **Cloudflare Pages가 same-origin API entry**
- **Vercel은 upstream / secondary entry**
- **Netlify는 fallback / legacy**
