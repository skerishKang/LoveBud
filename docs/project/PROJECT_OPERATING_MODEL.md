# Project Operating Model

## 목적

이 문서는 LoveBud 프로젝트의 운영 구조, 승인권, 세션 시작 프로토콜, 그리고 문서 TF 상세 구조를 정리하는 canonical 문서입니다.

이 문서는 상단에 LoveBud 전체 3TF 구조를, 하단에 문서 TF 상세 운영 구조를 정리합니다.

## LoveBud 전체 3TF 구조

LoveBud TF 구조는 아래 3개로 고정합니다.

- 문서 TF
- UI TF
- 기능 TF

각 TF는 Lead 1명만 둡니다.

- Document Lead
- UI Lead
- Feature Lead

각 TF의 실행 모델은 아래와 같습니다.

- 문서 TF: Document Web
- UI TF: UI Web, UI Local
- 기능 TF: Feature Web, Feature Local

전체 보고선은 아래를 따릅니다.

- CTO ← 각 TF Lead ← 각 실행 모델

## 공통 운영 원칙

### CTO
- 최종 승인권자입니다.

### 각 TF Lead
- 소속 TF 구조를 정리합니다.

### 각 실행 모델
- 현재 `main` 기준 문서를 먼저 확인합니다.

## 문서 TF 상세 구조

문서 TF 내부 역할선은 아래만 허용합니다.

- CTO
- Document Lead
- Document Web

## 관련 문서

- [REPORTING_CHAIN.md](./REPORTING_CHAIN.md)
