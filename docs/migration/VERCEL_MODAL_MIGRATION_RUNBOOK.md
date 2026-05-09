# Cloudflare Pages & Modal Migration Status

본 문서는 Netlify 중심 구조에서 **Modal > Cloudflare Pages > Vercel > Netlify** 운영 구조로 전환된 현재 상태를 정리합니다.

## 1. 현재 기준

- 공식 서비스 주소: `https://lovebud.pages.dev/`
- Cloudflare Pages는 공식 사용자-facing 진입점입니다.
- Modal은 browse summary / community/private read / read-heavy aggregation의 1순위 계층입니다.
- Vercel은 upstream / secondary entry 계층입니다.
- Netlify는 fallback / legacy 계층입니다.

## 2. 현재까지 완료된 것

- Cloudflare Pages `functions/api/[[path]].js` 기반 same-origin API entry 구축
- browse summary 요청 시 Modal 우선 호출 반영
- community/private read 경로의 Modal 우선 처리 반영
- Cloudflare Pages에서 Vercel upstream fallback 유지
- 프런트 상대 경로(`/api/...`) 기준 통신 정리
- 실서비스 주소를 `pages.dev` 기준으로 운영

## 3. 현재 계층 구조

1. **Modal**
   - browse summary
   - community/private read
   - public read aggregation
2. **Cloudflare Pages**
   - 공식 프런트 엔트리
   - same-origin API router
3. **Vercel**
   - upstream / secondary entry
   - fallback origin
4. **Netlify**
   - legacy fallback
   - 일부 기존 read/write 유지

## 4. 남아 있는 전이기 구조

아직 완전 제거되지 않은 항목:

- Cloudflare Pages fallback upstream으로 Vercel 의존이 남아 있음
- 일부 기존 CRUD와 auth-required legacy 경로는 Netlify 의존이 남아 있음
- Modal / Vercel / Netlify 간 책임이 완전히 단일화되지는 않음

즉, 현재 상태는 **Modal + Cloudflare Pages가 앞단을 잡고, Vercel과 Netlify가 뒤에서 받치는 전이기 구조**입니다.

## 5. 운영에서 헷갈리면 안 되는 기준

- `lovebud.pages.dev`가 공식 주소입니다.
- `lovebud.vercel.app`는 공식 사용자-facing 대표 주소가 아닙니다.
- `lovebud.netlify.app`는 공식 주소가 아닙니다.
- browse summary의 1순위는 Modal입니다.
- Cloudflare Pages가 same-origin API entry입니다.
- Vercel은 upstream / secondary entry입니다.

## 6. 환경 변수 기준

### Cloudflare Pages
- `MODAL_BASE_URL`
- `LOVEBUD_UPSTREAM_ORIGIN`

### Modal
- `DATABASE_URL` (Modal secret)
- `CORS_ALLOWED_ORIGINS` (필요 시)

## 7. 다음 단계

- Vercel upstream 의존 범위를 더 줄일 수 있는지 검토
- Netlify legacy read/write 의존을 점진적으로 축소
- Modal read 품질과 connection resilience 지속 보완
- 운영 문서에서 `pages.dev` 기준을 source of truth로 유지
