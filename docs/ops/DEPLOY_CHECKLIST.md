# LoveBud 배포 체크리스트

이 문서는 현재 운영 기준인 **Cloudflare Pages Entry + Modal Active Runtime > Vercel Transitional Fallback > Netlify Legacy Artifact** 구조에서 배포 전후 확인 항목을 정리합니다.

- 공식 서비스 주소: `https://lovebud.pages.dev/`
- 브라우저 API 기준: Cloudflare Pages same-origin `/api/...`
- Cloudflare Pages 역할: 공식 사용자-facing production / preview entry
- Modal 역할: active compute/runtime 우선 경로
- Vercel 역할: deprecated transitional fallback / upstream under audit
- Netlify 역할: legacy / fallback / artifact. `netlify/functions/*`는 현재 active production backend가 아님

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
- Cloudflare PR Preview / branch preview가 UI/API 의존 화면의 preview 검증 기준입니다.
- Vercel / Netlify는 보조 또는 legacy 계층입니다.
- Netlify 관련 파일은 삭제 대상이라고 단정하지 않지만, active production runtime처럼 설명하지 않습니다.
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

검증 원칙:
- Browse/Search/API 의존 화면은 로컬 정적 서버 단독 PASS 금지입니다.
- UI/layout PR은 Cloudflare PR Preview 또는 지정 test slot URL에서 확인합니다.
- post-merge 확인은 Cloudflare Pages production URL에서 진행합니다.

### Test slot verification note

- 로그인 필요 화면(`editor`, `my-trees`, `settings`)은 PR Preview에서 auth/domain 문제가 있으면 fixed test slot을 사용합니다.
- test1은 기본적으로 UI PR 검증용이며 `origin/test1` 기준으로 운영합니다.
- test slot URL 접근 불가 또는 DNS 실패는 code failure로 단정하지 말고 slot infra blocker로 분리합니다.
- Browser / Web / Local 역할 구분, PARTIAL/BLOCKED 판정, release/restore 절차는 [TEST_PREVIEW_SLOTS.md](TEST_PREVIEW_SLOTS.md)를 따릅니다.

## 5. fallback / legacy 점검

- [ ] Modal 차단 시 browse summary가 Vercel upstream fallback으로 계속 응답하는지 확인
- [ ] catch-all `/api/*`가 `LOVEBUD_UPSTREAM_ORIGIN` 기준으로 정상 proxy 되는지 확인
- [ ] Netlify legacy 계층이 필요한 경로 또는 CI/local harness에서만 보조적으로 관여하는지 확인

주의:
- CI/E2E smoke workflow에서 `netlify dev`가 쓰일 수 있습니다.
- 이 경로는 local test harness이며, production active runtime이 Netlify라는 뜻이 아닙니다.
- Netlify dev의 env 누락 failure는 production Cloudflare/Modal runtime failure와 분리해서 봅니다.

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

5. **Netlify dev / legacy function failure**
   - CI/local harness인지 확인
   - `NETLIFY_DATABASE_URL` / `DATABASE_URL` 누락인지 확인
   - production Cloudflare Pages URL에서 재현되는지 분리 확인

6. **Auth Domain Error**
   - Firebase Console 승인 도메인 확인

## 7. 오래된 설명 제거 기준

배포/운영 문서에서 아래 표현은 사용하지 않습니다.

- `lovebud.vercel.app`를 공식 사용자-facing 주소처럼 설명하는 문장
- `lovebud.netlify.app`를 주서비스처럼 설명하는 문장
- Netlify를 primary runtime으로 설명하는 문장
- `netlify/functions/*`를 active Cloudflare/Modal backend 구현 위치처럼 설명하는 문장
- Cloudflare Pages를 무시하고 Vercel을 공식 진입점으로 단정하는 문장
- CI/E2E의 `netlify dev` 사용을 production runtime truth로 해석하는 문장

현재 기준 문장:
- **공식 주소는 Cloudflare Pages (`pages.dev`)**
- **browse summary와 active compute의 1순위는 Modal**
- **Cloudflare Pages가 same-origin API entry**
- **Vercel은 deprecated transitional fallback / upstream under audit**
- **Netlify는 legacy / fallback / artifact**
