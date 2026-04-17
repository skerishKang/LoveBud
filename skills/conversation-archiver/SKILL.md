# Conversation Archiver

## 이 스킬을 언제 쓰이나?

- **새 transcript 유입 시**: 터미널에서 저장한 `.txt`/`.md` 원문을 정식 conversation 문서 체계로 편입할 때
- **세션 종료 시**: 긴 작업 후 summary와 index 정리가 필요할 때
- **긴 대화 정리 시**: 원문 파일을 올바른 이름/위치로 정리해야 할 때
- **핸드오프/요약**: 다음 에이전트나 사용자에게 컨텍스트 전달할 때
- **일 단위 종료**: 하루 작업 결과를 정리할 때

## 스킬 모드

이 스킬은 하나로 유지하되, 내부적으로 아래 2가지 모드로 동작합니다.

### 1. intake

새로 들어온 transcript 파일을 정식 아카이브에 편입하는 모드.

사용 예:
- `root3.txt`
- `session.txt`
- 날짜는 맞지만 제목이 부정확한 `.md`
- 사용자가 터미널에서 무심코 저장한 대화 파일

이 모드에서 하는 일:
1. 입력 파일이 실제 transcript인지 판별
2. 날짜 / 세션 번호 / 제목을 본문 분석으로 결정
3. 필요하면 `.txt`를 `.md`로 승격
4. `docs/conversation/full/`에 정식 이름으로 편입
5. summary 생성
6. index 갱신

### 2. maintenance

이미 정리된 conversation 문서들을 감사하고 구조를 정리하는 모드.

사용 예:
- 제목이 모호한 문서 재검토
- raw / derived / summary 혼재 정리
- summary 누락 보완
- index 정합성 수정
- 잘못된 위치의 문서 재배치 판단

## 입력으로 필요한 것

| 항목 | 필수 | 설명 |
|------|------|------|
| full 원문 | 선택 | 대화 전문 파일 경로 또는 전문 내용 |
| 날짜 | 필수 | YYYY-MM-DD 형식 |
| 세션 번호 | 필수 | NN |
| 짧은 제목 | 필수 | 파일명에 사용할 핵심 키워드. 본문 핵심 작업/판단이 드러나야 함 |
| 핵심 판단 | 필수 | 확정된 내용 |
| 완료 작업 | 필수 | 마친 작업 목록 |
| 커밋 | 선택 | 최종 커밋 해시 |

## 입력 파일 규칙

- 입력 파일명은 신뢰하지 않습니다.
- 입력이 `.txt`여도 괜찮습니다.
- 정식 아카이브에 편입할 때는 `.md`로 변경할 수 있습니다.
- 중요한 것은 확장자가 아니라 **본문이 실제 transcript인지** 여부입니다.
- transcript가 아니라 handoff / 정리본 / summary면 intake가 아니라 maintenance 대상으로 봅니다.

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

## 제목 선정 규칙

제목은 단순 라벨이 아니라 **본문의 실제 핵심 내용을 대표해야 합니다.**

좋은 제목의 기준:
- 세션에서 실제로 가장 많은 비중을 차지한 작업/판단이 드러남
- 나중에 목록만 봐도 어떤 세션인지 복구 가능
- 너무 포괄적인 표현(`handoff`, `misc`, `update`, `notes`)만 단독으로 쓰지 않음
- 가능하면 핵심 명사 1-2개 + 핵심 작업 1개 조합으로 작성
- 제목만 읽어도 "무슨 작업 세션이었는지" 대략 복원 가능해야 함

권장 형식:
- `{핵심 주제}-{핵심 작업}`
- `{문제 영역}-{정리/수정/검증}`
- `{페이지명}-{핵심 이슈}`

예시:
- `runtime-stabilization`
- `asset-versioning-and-db-diagnosis`
- `editor-null-fix`
- `browse-schema-unification`
- `codex-handoff-rules`
- `wsl-google-drive-path-failure`
- `static-asset-versioning-rules`
- `public-tree-db-diagnosis`

피해야 할 제목:
- `handoff`
- `update`
- `misc`
- `notes`
- `temp`

조건부로만 허용되는 제목:
- `handoff`
- `review`
- `sync`
- `cleanup`

위 표현은 반드시 뒤에 구체 대상이 붙어야 한다.

예:
- `codex-handoff-rules`
- `search-review-regressions`
- `docs-sync-conversation-structure`
- `cache-cleanup-private-public-split`

제목을 정할 때 순서:
1. 본문에서 가장 큰 비중의 주제 1-2개를 뽑는다
2. 실제로 수행한 동사(정리, 수정, 검증, 복구, 진단)를 붙인다
3. 너무 넓으면 범위를 줄이고, 너무 모호하면 대상 영역을 추가한다
4. 그래도 애매하면 요약 문서의 `핵심 주제`와 일치하도록 맞춘다

## 제목 결정 절차

제목은 아래 절차로 결정한다.

1. 본문 전체를 훑어 **가장 반복되는 명사/영역**을 찾는다
   - 예: `editor`, `browse`, `i18n`, `shared-header`, `wsl`, `db`
2. 세션의 **실제 중심 동사**를 정한다
   - 예: `fix`, `diagnosis`, `stabilization`, `rules`, `migration`, `audit`
3. 세션에서 부차적 내용이 많아도, **가장 큰 축 1개**를 제목 기준으로 삼는다
4. 제목 후보를 2-3개 만들고, 그중 가장 구체적인 것을 선택한다
5. 선택한 제목이 아래 질문에 "예"여야 한다
   - 이 제목만 보고도 다음 세션이 대략 복원되는가?
   - 같은 날짜의 다른 세션 제목과 구분되는가?
   - `handoff/update/misc` 없이도 성격이 드러나는가?

## 제목 판단 우선순위

여러 주제가 섞인 세션이면 아래 우선순위로 제목을 정한다.

1. 실제 코드/런타임 문제 해결
2. 운영 규칙/구조 결정
3. 데이터/배포/환경 진단
4. 문서 정리
5. 일반 handoff

즉 handoff 성격이 있더라도,
실제 본문 중심이 `에셋 버전 규칙 + DB 진단`이면
`handoff`보다 `asset-versioning-and-db-diagnosis`가 우선이다.

## 제목 감사 규칙

이미 존재하는 파일도 다음 조건이면 제목 재검토 대상이다.

- 제목이 `handoff`, `update`, `notes`처럼 지나치게 포괄적임
- 본문 핵심 주제와 파일명이 어긋남
- 같은 날짜 문서끼리 구분이 어려움
- 사용자가 제목만 보고 내용을 짐작하기 어려움

이 경우:
1. 본문 기준으로 더 정확한 제목 후보를 제안
2. rename 필요 여부를 판단
3. 관련 index 링크도 함께 갱신

## 가장 중요한 원칙

### 1. `full/`은 원문 보존 폴더

- 이미 대화 전문 파일이 있으면 **새로 쓰지 말고** 가능한 한 그대로 사용
- 우선순위는 `생성`보다 **중복 판별 → rename/move → index 반영**
- `full`에 해석이나 요약을 덧씌우지 말 것
- intake 시 `.txt`를 `.md`로 바꿀 수는 있지만, 본문 내용은 바꾸지 말 것

### 2. `summary/`는 구조화된 2차 문서

- 핵심 주제
- 확정 판단
- 완료 작업
- 중요 커밋
- blocker
- 다음 액션

이런 분석/구조화는 `summary`에 둡니다.

### 3. 먼저 중복 판별

임시 파일(`root.txt`, `root1.txt`)이 들어오면 바로 새 문서를 만들지 말고:

1. 기존 `docs/conversation/full/` 문서와 중복인지 확인
2. 중복이 아니면 정식 이름으로 rename/move
3. 그 다음 summary 생성 여부 판단

## 권장 작업 순서

### intake 순서

1. 입력 transcript 파일 목록 확인
2. 각 파일이 실제 RAW인지 우선 판별
3. 기존 `full/` 문서와 중복 여부 비교
4. 날짜 / 세션 번호 / 제목 후보 추정
5. 제목을 본문 대표성 기준으로 확정
6. 필요하면 `.txt` → `.md`로 변경
7. 원문 그대로 `docs/conversation/full/YYYY-MM-DD-NN-짧은제목.md`로 이동/rename
8. summary 생성
9. `full_index.md`, `summary_index.md` 업데이트
10. 처리 결과를 RAW / DERIVED / SUMMARY 기준으로 짧게 기록

### maintenance 순서

1. `AGENTS.md`, `docs/doc_index.md`, 기존 `full_index.md`, `summary_index.md` 확인
2. 임시 전문 파일의 날짜 / 세션 번호 / 제목 후보 추정
3. 기존 full 문서와 중복 여부 비교
4. 중복이 아니면 원문 그대로 `full/`로 rename/move
5. summary 생성 또는 갱신
6. `full_index.md`, `summary_index.md` 업데이트
7. 원본 임시 파일 삭제/유지 여부 판단 기록

## full 처리 규칙

- 가능하면 **원문 그대로 유지**
- `.txt`에서 `.md`로 바꾸더라도 본문은 손대지 않는 쪽을 우선
- 전문에 분석용 헤더를 덧붙이지 말 것
- 정말 필요한 경우에만 파일명/경로만 정리
- 단, 파일명에 들어가는 제목은 본문 대표성이 있도록 충분히 검토

## intake 제목 생성 규칙

새 transcript 파일이 들어오면 제목은 **파일명으로 정하지 않고 본문 분석으로 정합니다.**

절차:
1. 본문 앞/중간/끝을 읽어 가장 큰 주제 1-2개를 파악
2. 반복되는 기술 영역 또는 문제 영역을 뽑음
3. 세션에서 실제로 한 동작을 붙임
4. 가장 구체적이고 복구 가능한 제목을 선택

예:
- 임시 파일명: `root5.txt`
- 본문 주제: WSL 경로 문제 + Google Drive + opencode/kilo 복구
- 정식 제목 후보:
  - `wsl-google-drive-cli-recovery`
  - `wsl-path-and-cli-fix`
  - `google-drive-wsl-runtime-recovery`

선택 원칙:
- 모든 주제를 나열하지 말 것
- 세션의 가장 큰 축 하나를 제목으로 삼을 것
- 나머지 주제는 summary가 받도록 할 것

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
- 기존 전문이 있으면 `docs/conversation/full/2026-04-17-03-editor-null-fix.md`로 rename/move
- `docs/conversation/summary/2026-04-17-03-editor-null-fix_summary.md`
- 각 index 파일에 행 추가

## root.txt / root1.txt 같은 임시 파일 처리 예시

입력:
- `docs/conversation/full/root1.txt`

처리:
1. 기존 full 문서와 중복인지 확인
2. 중복이 아니면 날짜/세션/제목을 판별
3. 필요하면 `.txt`를 `.md`로 바꾸고, 원문 그대로 `docs/conversation/full/YYYY-MM-DD-NN-짧은제목.md`로 이동
4. summary 생성
5. index 갱신

중요:
- 이 경우 `full` 문서는 새로 쓰지 않는다
- 핵심 해석은 `summary`로 보낸다
- 제목은 `handoff`처럼 뭉뚱그리지 말고 실제 본문 주제를 반영한다

## 여러 개 transcript를 한 번에 처리할 때

사용자가 `full/` 폴더에 `.txt` 파일 여러 개를 가져다 놓을 수 있습니다.

이 경우:
1. 각 파일을 독립 세션으로 본다
2. 파일명은 임시값으로 보고 신뢰하지 않는다
3. 날짜와 세션 번호 충돌이 없는지 확인한다
4. 각 파일마다 제목 / summary / index 반영을 개별 수행한다
5. 한 파일의 제목을 다른 파일에 재사용하지 않는다

## 하지 말아야 할 것

- raw transcript 본문을 summary처럼 다시 쓰기
- 제목을 파일명에서 기계적으로 복사하기
- `handoff`, `misc`, `update` 같은 제목을 단독 사용하기
- full과 summary의 역할을 섞기
- intake 작업에서 관련 없는 기존 문서를 과하게 리팩터링하기
