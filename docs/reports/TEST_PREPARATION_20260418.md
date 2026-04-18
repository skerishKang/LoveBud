# LoveBud 테스트 준비 보고서

## 1. 개요
`AGENTS.md` 및 `docs/test-scenarios`를 검토한 결과, 서비스의 핵심 루프(가입-트리생성-노드반복생성)를 검증하기 위한 준비를 마쳤습니다.

## 2. 테스트 환경 점검
- **서비스 URL**: [https://lovebud.netlify.app](https://lovebud.netlify.app)
- **로컬 테스트 계정**: `.local/test-accounts.json` 확인 완료 (기존 3개 계정 보유)
- **테스트 데이터**: IVE, BTS, 하츠투하츠 데이터 준비 완료 (`docs/test-scenarios/data/`)
- **공통 시나리오**: `repeatability-node-creation-test.md` (Version 1.0) 확인 완료

## 3. 첫 번째 테스트 선정: IVE 신규 가입자 여정
가장 표준적인 검증을 위해 **IVE 신규 가입자** 테스트를 우선 수행할 것을 제안합니다.

### 📋 테스트 상세 정보
- **시나리오명**: `REPEAT-NODE-001` (노드 반복 생성 테스트)
- **대상**: 신규 가입자 (New User)
- **아이돌**: IVE (아이브)
- **목표 결과 파일**: `docs/test-scenarios/results/ive-newuser-test-2026-04-18-2210.md`
- **사용 데이터**: `data/ive-data.json` (URL 6개)

### 👤 테스트 계정 (임시 생성 예정)
- **이메일**: `test-20260418-2210-99@test.com` (패턴 적용)
- **비밀번호**: `TestPass123!`
- **닉네임**: `IVE Fan Test`

## 4. 테스트 단계 (Plan)
1. **STEP 1**: [홈페이지](https://lovebud.netlify.app) 접속 및 첫 인상 기록
2. **STEP 2**: 회원가입 진행 (신규 이메일 사용)
3. **STEP 3**: "아이브 콘텐츠 정리용 트리" 생성
4. **STEP 4**: 노드 4개 반복 생성 (IAM, Love Dive, After LIKE, 유진 직캠)
5. **STEP 5**: 추가 노드 2개 생성 및 반복 피로도 측정 (원영 직캠, ELEVEN MV)
6. **STEP 6**: 최종 트리 구조 확인 및 에지 케이스(잘못된 URL 등) 검증
7. **정리**: 결과 리포트 작성 및 UX 개선 포인트 도출

## 5. 수행 전 체크리스트
- [x] AGENTS.md 숙지 (Codex 가이드 준수)
- [x] 테스트 시나리오 및 데이터 정렬 완료
- [x] 테스트 계정 생성 규칙 확인
- [ ] 브라우저 도구 (Playwright) 준비 상태 확인

---
> [!IMPORTANT]
> 테스트를 바로 시작할까요? 아니면 특정 데이터나 시나리오를 수정할까요?
