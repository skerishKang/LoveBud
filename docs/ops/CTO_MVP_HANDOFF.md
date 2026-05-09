# LoveBud CTO 핸드오프

## 1. 이 문서의 역할

이 문서는 더 이상 오래된 `133-relovetree` 빠른 MVP 브랜치 전제를 따르지 않습니다.

이 문서는 **현재 main 기준 LoveBud 운영 진실과 우선 작업 큐**를 전달하기 위한 CTO 핸드오프입니다.

즉, 아래와 같은 오래된 전제는 더 이상 이 문서의 기준이 아닙니다.

- `133-relovetree`가 현재 기준이라는 설명
- JS가 아직 전반적으로 목데이터 기반이라는 단정
- 일부 페이지/스크립트 계약이 깨진 상태가 현재 기준이라는 단정
- "정적 프로토타입 정리 단계"가 현재 저장소의 대표 상태라는 설명

현재 기준 진실의 출처는 아래 문서를 우선합니다.

1. `README.md`
2. `docs/ops/OPERATIONS.md`
3. `docs/doc_index.md`
4. `docs/product/PRODUCT_IDENTITY.md`
5. `docs/engineering/API_CONTRACT.md`

---

## 2. 현재 운영 진실

### 공식 사용자 진입점

- 공식 서비스 주소: `https://lovebud.pages.dev/`
- 공식 사용자-facing entry: **Cloudflare Pages**

### 현재 인프라 우선순위

> **Modal > Cloudflare Pages > Vercel > Netlify**

- **Modal**: browse summary, snapshot, read-heavy compute 우선 계층
- **Cloudflare Pages**: 실서비스 프런트 및 same-origin `/api/*` entry
- **Vercel**: upstream / secondary entry / proxy fallback 계층
- **Netlify**: legacy fallback 또는 단계적 제거 대상 레거시 계층

### 브라우저 계약

브라우저는 가능하면 **same-origin `/api/*`** 만 사용합니다.

즉 프런트 코드의 기본 계약은 아래 한 줄입니다.

- 브라우저는 현재 접속한 호스트 기준 `/api/*` 로 요청한다.

그 뒤의 실제 라우팅은 Cloudflare Pages functions, Modal, Vercel, Netlify가 전이기 구조 안에서 처리합니다.

---

## 3. 지금 무엇이 문제였는가

이번 정리 전에는 아래 같은 운영 불일치가 존재했습니다.

1. `package.json` 설명이 예전 Netlify 중심 설명을 유지하고 있었음
2. `js/postgres-client.js` 상단 주석이 Netlify Functions 기준으로 남아 있었음
3. `api/[...path].js` 기본 upstream이 Netlify API를 향하고 있었음
4. 이 문서 자체가 오래된 MVP/목데이터 전제를 current truth처럼 설명하고 있었음

이런 상태는 로컬 작업 모델이나 신규 리뷰어가 잘못된 전제를 진실로 오인하게 만들고,
그 결과 운영 구조와 반대로 리팩터링할 위험을 만듭니다.

---

## 4. 이미 반영해야 하는 원칙

아래 원칙은 앞으로 코드/문서/리뷰 공통 기준으로 유지합니다.

### 4.1 문서 원칙

- Cloudflare Pages를 공식 서비스 entry로 설명한다.
- Vercel과 Netlify를 주서비스처럼 설명하지 않는다.
- Vercel은 보조/전이기 계층으로 설명한다.
- Netlify는 legacy fallback으로 설명한다.
- 오래된 문서는 삭제보다 **현재 기준이 아님을 명확히 표기**하는 방향을 우선한다.

### 4.2 코드 원칙

- 브라우저 코드는 same-origin `/api/*` 기준을 유지한다.
- Vercel catch-all은 기본적으로 Netlify가 아니라 **Vercel 보조 upstream**을 향해야 한다.
- 특정 fallback을 강제해야 할 때만 환경변수로 override 한다.
- 브라우저 코드 주석은 특정 플랫폼 종속 진술을 최소화하고 현재 운영 구조를 정확히 반영한다.

### 4.3 리뷰 원칙

- "현재 진실의 출처"를 먼저 확인하지 않은 채 generic한 구조 비판을 하지 않는다.
- 운영 문서와 충돌하는 가정으로 리팩터링하지 않는다.
- 배포 주소, API entry, publication/browse 개념을 혼동하지 않는다.

---

## 5. 현재 최우선 작업 큐

### P0. 운영 진실 일원화

목표:
저장소 전체에서 **현재 운영 진실의 출처를 하나로 맞추는 것**

해야 할 일:

1. 문서/주석/설명에서 예전 Netlify 중심 설명 제거
2. Cloudflare Pages = 공식 entry 라는 표현 통일
3. Vercel/Netlify = 보조/전이기 계층 설명 통일
4. 오래된 handoff나 migration 문서에 current truth 여부 라벨 부여

### P1. 프런트-API 계약 점검

목표:
브라우저 same-origin `/api/*` 원칙이 실제 코드와 문서에서 완전히 일치하도록 정리

해야 할 일:

1. `/api/*` 호출 경로 전체 점검
2. fallback 체인 문서화
3. 환경변수 없을 때 잘못된 기본 동작 제거
4. Cloudflare / Vercel / Netlify 역할을 코드 단위로 명확히 적시

### P2. 첫 사용자 활성화 루프 정리

목표:
홈 → 로그인 → 첫 트리 생성 → 첫 기억 저장 루프를 더 짧고 명확하게 만들기

해야 할 일:

1. 빈 상태와 첫 CTA 점검
2. 로그인 후 redirect 흐름 점검
3. 첫 생성 성공률을 방해하는 문구/레이아웃 제거
4. 핵심 계측 포인트 정의

### P3. browse/detail 상용화 준비

목표:
공개 둘러보기와 상세 페이지를 공유 가능한 가치 허브로 강화

해야 할 일:

1. 대표 썸네일/대표 순간/대표 감정 표현 강화
2. 공개 설정과 publication guard 정합성 점검
3. 공유 링크/OG/검색 노출 여지 점검
4. 범용 SNS화 없이 기록 아카이브 정체성 유지

---

## 6. 작업자에게 줄 기준

로컬 작업 모델이나 협업자에게 작업을 줄 때는 아래 순서를 지킵니다.

1. 현재 truth 문서 먼저 읽기
2. 작업 범위를 한 번에 하나로 제한
3. 문서 수정인지, 코드 수정인지, 운영 검증인지 분리
4. 결과 보고는 항상 아래 형식 사용

- 변경 파일 목록
- 무엇을 왜 바꿨는지
- current truth와 어떻게 맞췄는지
- 아직 남아 있는 레거시 흔적
- 다음 작업 추천 1개

---

## 7. 지금 승인 기준

아래 조건을 만족해야 CTO 기준으로 승인합니다.

- 공식 서비스 주소가 `lovebud.pages.dev` 기준으로 설명되는가
- 브라우저 계약이 same-origin `/api/*` 로 정리되는가
- Vercel이 보조 계층으로 설명되는가
- Netlify가 legacy fallback으로 설명되는가
- 오래된 문서가 current truth처럼 읽히지 않는가
- 새 작업자가 이 문서만 읽고도 잘못된 인프라 가정을 하지 않는가

---

## 8. 다음 순서

지금 이 문서가 정리된 뒤 바로 이어서 해야 할 권장 순서는 아래입니다.

1. source-of-truth 불일치 문서 추가 스캔
2. `/api/*` 실제 fallback 맵 정리
3. 첫 사용자 활성화 퍼널 개선
4. browse/detail 상용화 구조 정리
5. 테스트/검증 체계 실전화

이 순서를 바꾸지 않는 것이 좋습니다.
기능 추가보다 먼저 **운영 진실의 출처를 통일**해야 이후 리팩터링이 덜 흔들립니다.
