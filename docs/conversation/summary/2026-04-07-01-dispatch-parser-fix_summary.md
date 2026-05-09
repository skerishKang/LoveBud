# 요약 - dispatch-parser-fix

**날짜**: 2026-04-07  
**세션 번호**: 01  
**핵심 주제**: 배차일보 CSV 파서의 구분자 감지 로직 개선

---

## 핵심 주제

네트워크 파서가 CP949 CSV 파일의 특정 행(SEAL NO 필드에 따옴표 내 탭 문자)을 잘못 처리하여 전체 파일을 탭 구분 파일로 오판하는 문제를 재현하고, `detectDelimiter()` 함수를 추가하여 구분자 감지 로직을 개선한 세션.

---

## 확정 판단

- **문제 원인**: 기존 `lines.some(v => v.includes("\t")) ? "\t" : ","` 로직이 첫 줄 기준으로만 구분자를 판단, 따옴표 내 탭 문자를 포함한 한 행으로 인해 전체 파일을 탭 구분으로 오인.
- **해결 방향**: `countDelimiterOutsideQuotes()` 함수로 각 행의 구분자 출현 횟수를 계산하고, 샘플 20행을 기반으로 가장 많은 매칭을 보이는 구분자를 선택하는 `detectDelimiter()` 도입.
- **파서 동작**: 현재 파서는 470건의 배차일보00.csv를 정상 파싱함 (날짜: 2026-03-01~25, 고객사 2개).

---

## 완료 작업

| # | 작업 | 상태 |
|---|------|------|
| 1 | 원본 CSV 파일의 구조 및 에러 현상 재현 | ✅ 완료 |
| 2 | `countDelimiterOutsideQuotes()` 함수 추가 | ✅ 완료 |
| 3 | `detectDelimiter()` 함수 추가 (샘플 기반 구분자 감지) | ✅ 완료 |
| 4 | `normalizeDispatchRowByHeader()`에서 구분자 판정 로직 교체 | ✅ 완료 |
| 5 | 실제 470건 데이터 파싱 검증 완료 | ✅ 완료 |

---

## 중요 커밋

- **커밋**: 해당 없음 (파일은 로컬에서 수정만 된 상태)
- **메시지**: fix: dispatch CSV delimiter detection for quoted tab character

---

## 남은 blocker

1. **파서 필드 매핑 불완전**: 현재 파서가 저장하지 않는 컬럼이 다수 존재(B/L NO, SEAL NO, VGM, TARE 등)
2. **실제 운영 전 검증 필요**: 누락 필드와 terminal/업체마감일 등의 null 값 처리에 대한 추가 검토 필요
3. **README 업데이트**: 공식 입력 포맷으로 CSV 형식 명시 필요

---

## 다음 액션

1. `netlify/functions/_dispatchParser.js`의 저장 필드 목록을 실제 DB 스키마와 맞추어 확장 검토
2. `data/배차일보00.csv`를 기준 샘플로 README에 업로드 규격 명시
3. parser의 출력 구조를 문서화하고, 향후 확장성을 고려한 필드 매핑 테이블 작성

---

##Metadata

created: 2026-04-07  
session: 01
