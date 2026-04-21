# LoveBud Runbook (운영 매뉴얼)

## 1. 프로젝트 주요 정보
- **공식 서비스 URL**: [https://lovebud.vercel.app/](https://lovebud.vercel.app/)
- **핵심 인프라 우선순위**: Modal (Compute) > Vercel (Front/Route) > Netlify (Backend Fallback)

## 2. 배포 절차 (Deployment)

### 프런트엔드 및 API 라우터 (Vercel)
- main 브랜치 푸시 시 자동 배포.
- **Vercel Functions**: pi/ 폴더 내의 로직이 동일 오리진(/api/...) 요청을 처리합니다.
- 수동 배포: ercel --prod

### 연산 레이어 (Modal)
- 코드 위치: modal_compute/app.py
- 배포 명령: modal deploy modal_compute/app.py
- 상태 확인: Modal Dashboard에서 lovebud-browse-snapshot 확인.

## 3. 장애 대응 (Troubleshooting)

### API 호출 실패 (502/503)
1. **증상**: 브라우저 콘솔에서 /api/... 요청이 실패하거나 에러 메시지 반환.
2. **원인 1 (Netlify Usage Exceeded)**: 
   - Netlify 무료 플랜 할당량 초과 시 발생.
   - **대응**: NETLIFY_API_BASE_URL 환경 변수를 업데이트하거나 Netlify 사이트 상태를 점검.
3. **원인 2 (Modal Timeout)**:
   - Browse 요청 (iew=summary) 시 Modal 응답이 2.2초 내에 오지 않을 경우.
   - **대응**: pi/community/trees.js는 자동으로 Netlify Fallback을 수행하므로, 전체 차단은 아니나 속도가 저하될 수 있음.

### 로그 확인 방법
- **Vercel**: Vercel Dashboard > Project > Logs (Serverless Functions 로그 확인).
- **Modal**: modal app logs lovebud-browse-snapshot

## 4. 환경 초기화 필수 체크리스트 (Vercel)
Vercel 배포 시 아래 환경 변수가 설정되어 있어야 합니다:
- MODAL_BASE_URL: Modal API 주소.
- NETLIFY_API_BASE_URL: https://lovebud.netlify.app/api.
- DATABASE_URL: Neon Postgres.
- FIREBASE_SERVICE_ACCOUNT_JSON: 인증용.

## 5. Firebase 인증 도메인
- lovebud.vercel.app 도메인이 Firebase Authentication > Authorized Domains에 등록되어 있어야 합니다.