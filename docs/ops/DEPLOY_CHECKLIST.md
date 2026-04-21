# LoveBud 배포 체크리스트 (Vercel & Modal 중심)

## 0. 빠른 엔드포인트 검증 (1분)

`ash
# Vercel 주소로 가속 레이어 동작 확인
curl -s -o /dev/null -w "%{http_code}" https://lovebud.vercel.app/api/community/trees?view=summary
# 기대: 200 (Modal에서 요약 데이터 반환)
`

## 1. Firebase Authorized Domains 점검
Firebase Console > Authentication > Settings > Authorized Domains 점검 필수:
- [ ] lovebud.vercel.app (Primary)
- [ ] lovebud.netlify.app (Fallback)
- [ ] localhost / 127.0.0.1

## 2. 환경 변수 동기화 (Vercel Dashboard)
- [ ] MODAL_BASE_URL
- [ ] NETLIFY_API_BASE_URL
- [ ] DATABASE_URL
- [ ] FIREBASE_SERVICE_ACCOUNT_JSON (인증용)

## 3. 배포 후 핵심 플로우 확인

| 플로우 | URL | 확인 사항 |
| :--- | :--- | :--- |
| 홈 | / | 정상 로드 |
| 검색 | /search.html | Modal 가속 데이터 로드 확인 |
| 로그인 | /login.html | Vercel 도메인에서 인증 성공 여부 |
| 에디터 | /editor.html | 데이터 저장 정합성 |

## 4. 장애 대응 우선순위
1. **503 Usage Exceeded**: Netlify 사이트 상태 확인 및 상향 조정 검토.
2. **Auth Domain Error**: Firebase Console 내 승인 도메인 설정 확인.
3. **Modal Timeout**: pi/community/trees.js 내부 타임아웃(2.2s) 설정에 따른 Fallback 정상 동작 확인.