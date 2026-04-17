# Backend 문서군

## 목적

이 폴더는 LoveBud의 백엔드, API, 데이터 구조 문서를 단계적으로 분리하기 위한 자리입니다.

## 먼저 읽기

이 폴더를 처음 접할 때는 다음 순서로 읽는 것을 권장합니다:

1. **[backend.md](./backend.md)** — 전체 백엔드 아키텍처 개요 및 API 계약
2. **[DATA_MODEL_DRAFT.md](./DATA_MODEL_DRAFT.md)** — 데이터 모델 상세
3. 필요시 운영 문서는 `docs/ops/` 참조

## 현재 문서

- [backend.md](./backend.md) - Netlify Functions 백엔드 개요 *(루트에서 이동)*
- [DATA_MODEL_DRAFT.md](./DATA_MODEL_DRAFT.md) - 데이터 모델 초안 *(product에서 이동)*

백엔드 논의가 커지면 이 폴더 아래로 문서를 분리합니다.

예상 문서:
- `API_CONTRACT.md`
- `DB_SCHEMA.md`
- `AUTH_AND_PERMISSIONS.md`
- `FUNCTION_MAP.md`

## 현재 운영 원칙

1. 기존 내용은 우선 `docs/backend.md`를 기준으로 유지
2. 대화하면서 백엔드 내용이 세분화되면 이 폴더로 분리
3. 페이지 문서와 연결해서 "어떤 페이지가 어떤 데이터를 필요로 하는가" 기준으로 쓴다
