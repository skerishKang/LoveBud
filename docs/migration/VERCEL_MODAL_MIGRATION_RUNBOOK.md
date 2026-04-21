# Vercel & Modal Migration Status (구현 현황)

본 문서는 Netlify 중심 인프라에서 Vercel(Front/Route) 및 Modal(Compute) 중심으로의 전환 경과를 기록합니다.

## 1. 완료된 작업 (Done)
- **Same-Origin API 라우터 구축**: Vercel api/ 폴더 내에 Node.js 기반 프록시 및 전용 핸들러 구축 완료.
- **Browse 가속 연동**: api/community/trees.js에서 view=summary 요청 시 Modal을 최우선으로 호출하는 로직 반영 완료.
- **Catch-all Proxy**: 특정되지 않은 /api/* 요청을 Netlify로 전달하는 api/[...path].js 구현 완료.
- **Frontend 업데이트**: base-api-fetch.js 및 postgres-client.js가 상대 경로(/api/...)를 사용하여 Vercel 도메인 내에서 통신하도록 수정 완료.

## 2. 운영 계층 (Hierarchy)
구현팀은 아래 순서에 따라 데이터와 트래픽을 처리합니다:
1. **Modal**: 브라우즈 요약 정보, 대량 데이터 복합 쿼리 (Primary Read)
2. **Vercel**: API 라우팅, 인증 미들웨어, 정적 자산 서빙 (Entry)
3. **Netlify**: 원천 데이터 CRUD, 레거시 인증 로직 (Storage/Write Fallback)

## 3. 향후 과제 (Next Steps)
- [ ] **Netlify 의존성 제거**: netlify/functions에 남아있는 모든 로직을 Vercel api/ 폴더로 100% 이관하여 Netlify 503 리스크 원천 차단.
- [ ] **Firebase 도메인 승인**: Vercel 프로덕션 도메인에 대한 Firebase Auth 도메인 등록 상태 상시 유지.
- [ ] **Modal Cache Policy**: Modal 응답에 따른 Vercel Edge Cache 설정 최적화.

## 4. 환경 변수 동기화 Checklist (Vercel)
- MODAL_BASE_URL
- NETLIFY_API_BASE_URL (Proxy 타겟)
- DATABASE_URL (Neon)
- FIREBASE_SERVICE_ACCOUNT_JSON