# Project Doc Sync

## 이 스킬을 언제 쓰이나?

- **대화 종료 후**: 페이지/기능/백엔드 논의를 정제 문서에 반영할 때
- **새 기능 추가 후**: API/스키마/상태 문서를 업데이트할 때
- **구조 정리 후**: 폴더/인덱스 변경을 문서 체계에 반영할 때
- **deploy 후**: 체크리스트나 환경 설정 문서 갱신이 필요할 때
- **정기 정합성 확인**: 전체 문서 구조와 내용이 구현과 맞는지 검토할 때

## 입력으로 필요한 것

| 항목 | 필수 | 설명 |
|------|------|------|
| 대상 문서 유형 | 필수 | product/pages/backend/ops/reports/plans 등 |
| 변경 사항 | 필수 | 대화 결과 또는 구현과 다른 부분 |
| 현재 상태 | 필수 | 코드/문서 기반 현재 구현 또는 현재 구조 |

## 출력 결과

- 갱신된 문서 (`docs/` 하위)
- 불필요한 과거 계획 제거
- 현재 상태 우선 정리
- 필요한 경우 index 문서 갱신
- 필요한 경우 문서 위치 재분류 제안

## 문서 유형별 책임

| 유형 | 대상 문서 | 갱신 주기 |
|------|----------|----------|
| **product** | `docs/product/*.md` | 제품 방향/범위/정책 변경 시 |
| **pages** | `docs/pages/*.md` | 페이지 UI/기능/상태 변경 시 |
| **backend** | `docs/backend/*.md`, `docs/backend.md` | API/스키마/함수 구조 변경 시 |
| **ops** | `docs/ops/*.md` | 운영 규칙/배포/환경 변경 시 |
| **reports** | `docs/reports/*.md` | 감사/완료/분석 결과 반영 시 |
| **plans** | `docs/plans/*.md` | 실행 계획/로드맵 변경 시 |

## 작업 원칙

> **중요**: LoveBud는 **컴2 (작업 사본)** 가 기준입니다.
> - 원본(컴1)의 문서와 다를 수 있음
> - 구현과 문서가 다르면 **문서가 아니라 구현을 기준**으로 함
> - 과거 계획보다 현재 상태 우선
> - 다만 제품/페이지 논의 중에는 **대화에서 확정된 설계 판단**을 먼저 문서에 반영한 뒤 구현으로 넘길 수 있음
> - 즉 이 스킬은 "구현 -> 문서"뿐 아니라 "대화 -> 정제 문서" 반영에도 사용함

### 구체 규칙

1. **구현 vs 문서 불일치**: 구현을 기준으로 문서 수정
2. **대화 vs 문서 불일치**: 제품/페이지 논의에서 확정된 내용을 문서에 반영
3. **삭제할 내용**: "추후 구현 예정"이지만 실제로 안 하거나 폐기된 것
4. **유지할 내용**: 현재 실제로 동작하거나 현재 기준으로 유효한 판단
5. **새로 추가**: 최근 커밋, 최근 대화, 최근 구조 정리에서 확정된 것
6. **문서 역할 분리 유지**:
   - `conversation/` = 기록
   - `pages/product/backend/ops/reports/plans` = 정제 문서
7. **index 문서 우선**:
   - 폴더 구조가 바뀌면 해당 폴더 `index.md`와 `docs/doc_index.md`를 함께 본다

## 현재 기준 문서 구조

이 스킬은 아래 구조를 기준으로 동작합니다.

- `docs/product/` = 제품 정체성, 범위, 흐름, 정책
- `docs/pages/` = 페이지별 UI/기능/상태/데이터/API 연결
- `docs/backend/` = 백엔드/API/데이터/함수 구조
- `docs/ops/` = 운영 규칙, 환경, 배포, 경로, 작업 흐름
- `docs/reports/` = 분석/완료/정리 보고
- `docs/plans/` = 실행 계획, 로드맵
- `docs/conversation/` = raw/summary/handoff 기록

## 작업 모드

### 1. content sync

대화 결과나 구현 변경을 정제 문서에 반영하는 모드.

예:
- editor 논의를 `docs/pages/editor.md`에 반영
- 백엔드 논의를 `docs/backend/backend.md`에 반영
- 제품 범위 변경을 `docs/product/MVP_SCOPE.md`에 반영

### 2. structure sync

문서 위치/인덱스/폴더 역할을 정리하는 모드.

예:
- 루트 문서를 하위 폴더로 이동
- `index.md` 신규 생성
- `doc_index.md` 갱신
- 폴더 역할 재분류

### 3. audit only

실제 수정 전에 문서 구조나 문서 내용을 감사하고 정리 계획만 세우는 모드.

## 작업 흐름

### 1. 대상 문서 확인

```bash
# 문서 목록 확인
ls docs/
ls docs/product/
ls docs/pages/
ls docs/backend/
ls docs/ops/
ls docs/reports/
ls docs/plans/

# 최근 변경된 문서 확인
git log --oneline -10 -- docs/
```

### 2. 현재 구현 상태 파악

```bash
# 관련 코드 확인
git diff HEAD~5 -- netlify/functions/

# API 엔드포인트 확인
grep -r "exports.handler" netlify/functions/
```

대화 기반 반영일 때는:

```bash
# 관련 conversation / page / backend 문서 확인
ls docs/conversation/summary/
ls docs/pages/
ls docs/backend/
```

### 3. 불일치 사항 정리

| 구분 | 처리 |
|------|------|
| 구현 != 문서 | 문서를 구현에 맞춤 |
| 대화 확정 != 문서 | 문서를 최신 설계 판단에 맞춤 |
| 과거 계획 | 삭제 또는 "제거됨" 표시 |
| 현재 상태 | 현재 기준으로 기술 |
| 잘못된 위치 | 더 적절한 폴더로 이동 제안 또는 실행 |

### 4. 문서 갱신

```markdown
## 변경 사항

### 변경 전
{과거 문구}

### 변경 후
{현재 구현}

### 이유
{왜 변경했는지}
```

##Templates

### plans_template.md

```
# 실행 계획 / 로드맵

> 기준: {날짜} | 컴2 (작업 사본)

## 완료된 항목

### ✅ {항목}
- {구현 완료일}
- {관련 커밋}

## 진행 중

### 🔄 {항목}
- {현재 상태}
- {예상 완료일}

## 보류/제거됨

### ⏸️ {항목}
- {이유}

##Metadata
updated: {YYYY-MM-DD}
```

### backend_doc_template.md

```
# {문서 제목}

> 기준: {날짜} | 컴2 (작업 사본)

## 현재 상태

### {항목1}
```
{현재 스키마/코드}
```

## 변경 이력

| 날짜 | 변경 내용 | 이유 |
|------|----------|------|
| {YYYY-MM-DD} | {변경} | {이유} |

##Metadata
updated: {YYYY-MM-DD}
```

### ops_doc_template.md

```
# {문서 제목}

> 기준: {날짜} | 컴2 (작업 사본)

## 현재 설정

### {항목}
```
{현재 설정값}
```

## 검증 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| {항목} | ✅/❌ | {비고} |

##Metadata
updated: {YYYY-MM-DD}
```

### pages_doc_update_rules

페이지 문서는 아래 항목을 함께 유지합니다.

- 페이지 목적
- 사용자 목표
- 주요 UI 섹션
- 현재 구현 상태
- 현재 잘 되는 것
- 문제/리스크
- 상태별 화면
- 필요한 데이터/API
- 다음 개선 포인트

### product_doc_update_rules

제품 문서는 아래 관점으로 정리합니다.

- 정체성
- MVP 범위
- 사용자 흐름
- 정책/규칙
- 현재 실행 기준

### index_sync_rules

폴더 구조가 바뀌면 함께 확인할 문서:

1. 해당 폴더 `index.md`
2. `docs/doc_index.md`
3. 관련 상위/하위 문서 링크

index는 단순 목록이 아니라 아래를 포함하면 좋습니다.

- 폴더 역할
- 먼저 읽기 순서
- 문서 그룹화
- 각 문서 한 줄 설명

##Metadata
created: 2026-04-17
category: documentation
