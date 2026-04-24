# Task Status

## 목적

이 문서는 LoveBud project 작업 상태를 기록하기 위한 전용 문서입니다.

## 상태 필드

- 진행 중
- 완료
- 보류
- 대기

## 원칙

- 상태만 기록
- 정책/운영 내용 포함 금지
- 수정, 검증, 추정은 구분하여 기록
- 세부 검증 기준은 [VERIFICATION_AND_EVIDENCE.md](./VERIFICATION_AND_EVIDENCE.md)를 따름

---

## 현재 상태 스냅샷

- 기준일: 2026-04-24
- 기준 main 커밋: `8f13e484dcd66d1817f0f476863add4fe0cfbd35`

| 구분 | 상태 | 기준/대상 | 현재 기록 |
|------|------|-----------|-----------|
| 문서 TF | 대기 | PR #8, PR #10 | project 운영 문서 및 검증 기준 문서 main 반영 완료. 추가 수정 없음 |
| UI TF | 완료 | PR #9 `ui: polish public search and detail copy` | main 병합 완료. 병합 커밋 `d5eee4468579059a959bbfdca4f5109647e29d4f`. production 검증 완료. UI TF 종료 승인 |
| 기능 TF | 완료 | `feature/search-growing-trees-api` | main과 identical. PR 생성 불필요. `/api/community/growing-trees` 운영 quick check 통과. UI 구현은 별도 작업으로 분리 |
| SVG Tree Prototype | 진행 중 | PR #7 `experiment: SVG tree prototype` | open / draft. merged 아님. 정식 기능 아님. navigation 연결 금지. 최신 main 반영 가능성 확인 필요 |

---

## 다음 예정 작업

| 작업 | 상태 | 메모 |
|------|------|------|
| Search에 “새로 자라는 러브트리” 보조 섹션 설계 | 대기 | 설계 승인 후 별도 브랜치에서 진행 |
| PR #7 재동기화 가능성 확인 | 대기 | prototype 상태 유지. main 병합 대상 아님 |
| Search 보조 섹션 UI 구현 | 대기 | 설계 승인 이후 UI 구현 브랜치 분리 |
