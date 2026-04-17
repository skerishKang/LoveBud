# Conversation Archiver

## 이 스킬을 언제 쓰이나?

- **세션 종료 시**: 긴 작업 후 요약 문서 필요할 때
- **긴 대화 정리 시**: 작업 흐름을 기록해야 할 때
- **핸드오프/요약**: 다음 에이전트나 사용자에게 컨텍스트 전달할 때
- **일 단위 종료**: 하루 작업 결과를 정리할 때

## 입력으로 필요한 것

| 항목 | 필수 | 설명 |
|------|------|------|
| full 원문 | 선택 | 대화 전문 파일 경로 또는 전문 내용 |
| 날짜 | 필수 | YYYY-MM-DD 형식 |
| 세션 번호 | 필수 | NN |
| 짧은 제목 | 필수 | 파일명에 사용할 핵심 키워드 |
| 핵심 판단 | 필수 | 확정된 내용 |
| 완료 작업 | 필수 | 마친 작업 목록 |
| 커밋 | 선택 | 최종 커밋 해시 |

## 출력 결과

| 파일 | 위치 |
|------|------|
| 전문 | `docs/conversation/full/YYYY-MM-DD-NN-짧은제목.md` |
| 요약 | `docs/conversation/summary/YYYY-MM-DD-NN-짧은제목_summary.md` |
| 전문 인덱스 | `docs/conversation/full/full_index.md` (갱신) |
| 요약 인덱스 | `docs/conversation/summary/summary_index.md` (갱신) |

## Naming 규칙

```
full:     docs/conversation/full/YYYY-MM-DD-NN-짧은제목.md
summary:  docs/conversation/summary/YYYY-MM-DD-NN-짧은제목_summary.md
full_index:    docs/conversation/full/full_index.md
summary_index: docs/conversation/summary/summary_index.md
```

- NN: 세션 번호 (두 자리 숫자, 예: 01, 02)
- 짧은 제목: 핵심 키워드 2-4단어 (한글 가능)

## Summary에 반드시 포함할 항목

```
1. 핵심 주제 - 이번 세션에서 다룬 핵심 내용
2. 확정 판단 - 작업 방향, 스코프, 우선순위
3. 완료 작업 - [{content, status}] todo 목록 기반
4. 중요 커밋 - 최종 커밋 해시와 메시지
5. 남은 blocker - 현재 막힌 사항
6. 다음 액션 - 다음 세션에서 할 일
```

## 다음 세션 읽기 루트

1. `AGENTS.md`
2. `docs/doc_index.md`
3. `docs/conversation/summary/summary_index.md`
4. 최신 summary 파일

full 전문은 summary만으로 부족할 때만 확인합니다.

## 사용 예시

```
세션 종료 후:
- 날짜: 2026-04-17
- 세션 번호: 03  
- 제목: editor-null-fix
- 핵심 판단: createdMemory null fallback 방어적 처리 적용
- 완료 작업: js/editor.js null 체크 추가, verify-core-flows.js 생성
```

결과:
- `docs/conversation/full/2026-04-17-03-editor-null-fix.md`
- `docs/conversation/summary/2026-04-17-03-editor-null-fix_summary.md`
- 각 index 파일에 행 추가