# Reporting Chain

## 목적

이 문서는 LoveBud의 TF 구조, TF별 Lead, 실행 모델, 보고선을 고정 표현으로 정리합니다.

## 3TF 구조

LoveBud TF 구조는 아래 3개로 고정합니다.

- 문서 TF
- UI TF
- 기능 TF

## TF별 Lead

각 TF는 Lead 1명만 둡니다.

- Document Lead
- UI Lead
- Feature Lead

## TF별 실행 모델

각 TF의 실행 모델은 아래와 같습니다.

- 문서 TF: Document Web
- UI TF: UI Web, UI Local
- 기능 TF: Feature Web, Feature Local

## 보고선

보고선은 아래로 고정합니다.

- CTO ← 각 TF Lead ← 각 실행 모델

## 문서 TF 내부 역할선

문서 TF 내부 역할선은 아래만 허용합니다.

- CTO
- Document Lead
- Document Web

## 사용 원칙

- 이 문서는 보고선과 역할 구조의 고정 표현만 다룹니다.
- 세션 시작 프로토콜과 문서 TF 상세 운영 기준은 `PROJECT_OPERATING_MODEL.md`를 따릅니다.
- 브랜치/리뷰 원칙은 `BRANCHING_AND_REVIEW.md`를 따릅니다.
