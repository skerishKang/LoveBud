# Skill: session-documentation

이 스킬은 LoveBud 세션을 종료할 때 대화 전문과 요약을 체계적으로 정리하는 작업을 표준화합니다.

## 언제 이 스킬을 쓰는지

- 세션 종료 직전 (다른 에이전트가 진입하기 전)
- 중요한 결정, 커밋, 작업 완료가 있었던 세션 기록을 남길 때
- 다음 세션 에이전트가 빠르게 진입할 수 있도록 context를 정리할 때

## 필요한 입력

1. **세션 기본 정보**:
   - 세션 날짜 (자동: 현재 날짜)
   - 세션 회차 (자동: 동일 날짜 마지막 회차 + 1)
   - 세션 핵심 주제 (1줄)

2. **확정된 판단** (3-5항목)

3. **완료된 주요 작업** (✅ 체크리스트 형식)

4. **중요 커밋 해시** (컴1/컴2에서 실제 확인한 것만)

5. **브라우저 검증 결과** (선택)

6. **남은 blocker / 다음 액션** (각 항목별 [ ] 체크박스)

7. **작업 사본 기준** (컴1/컴2 구분)

## full 문서 생성 규칙

1. **파일명**: `YYYY-MM-DD-NN-짧은제목.md`
   - `YYYY-MM-DD`: 세션 날짜
   - `NN`: 해당 날짜 회차 (01부터 시작)
   - `짧은제목`: 세션 핵심 주제를 영어 소문자+하이픈으로 (예: `runtime-stabilization`)

2. **위치**: `docs/conversation/full/`

3. **내용**: 대화 전문 전체 (원본 그대로 보관)

4. **rename 규칙**:
   - 임시 파일(`root.txt` 등)이 있으면 즉시 rename
   - 파일명은 다른 인덱스 파일과 중복되지 않게 함

## summary 작성 규칙

1. **파일명**: `YYYY-MM-DD-NN-짧은제목_summary.md`
   - full 파일명에 `_summary` 접미사

2. **위치**: `docs/conversation/summary/`

3. **필수 섹션** (순서대로):
   ```
   # YYYY-MM-DD: 세션 제목
   
   ## 세션 핵심 주제
   - 1~2줄
   
   ## 확정된 판단
   -numbered list (1-5)
   
   ## 완료된 주요 작업
   - ✅ 이모지 + 설명 (커밋 해시 포함)
   
   ## 중요한 커밋 해시
   - `해시` 설명
   
   ## 남은 Blocker / 다음 액션
   - [ ] 체크박스 형식
   
   ## 작업 사본 기준
   - 어디서 작업했는지 명시
   ```

4. **요구사항**:
   - 다음 세션 에이전트가 **이 문서만 보고** 전체 상황을 파악할 수 있어야 함
   - raw key 노출, 미확인 정보는 피하기
   - 길지 않게, 압축적으로 (총 30-50줄 내외)

## 인덱스 갱신 규칙

### full_index.md
```markdown
## 파일 목록

| 날짜 | 파일명 | 설명 |
|------|--------|------|
| YYYY-MM-DD | [파일명](링크) | 한 줄 설명 |
```
- 새로운 세션 추가 시 테이블 맨 아래에 행 추가
- `full/` 하위에서 상대경로로 링크

### summary_index.md
```markdown
## 파일 목록

| 날짜 | 요약 파일명 | 전문 파일명 | 상태 |
|------|------------|------------|------|
| YYYY-MM-DD | [요약](링크) | [전문](../full/링크) | ✅ 완료 |
```
- 요약과 전문을 모두 연결
- 상태: `✅ 완료` (또는 `🔄 진행중`)

### docs/doc_index.md
- 이미 존재하는 최상위 문서 인덱스
- conversation 문서군 링크가 올바른지 확인
- 필요시 수정하되, 구조는 건드리지 않음

## 읽기 흐름 (다음 세션 진입 시)

다음 에이전트는 이 순서로 읽어야 합니다:

1. `AGENTS.md` - 운영 원칙, 역할, 규칙
2. `docs/doc_index.md` - 문서 구조 전망
3. `docs/conversation/summary/summary_index.md` - 요약 목록
4. **가장 최신 summary 파일** (`summary/` 하위) - 세션 핵심 내용
5. 필요시 `docs/conversation/full/full_index.md` → 해당 full 문서

이 순서를 통해 5분 내로 세션 전체 맥락 파악 가능.

## 자동화 가능한 부분

- 파일명 생성 (날짜 + 회차 자동계산)
- full_index.md / summary_index.md 테이블 행 자동 추가
- summary 템플릿 자동 생성 (필요 정보 입력 시)

## 수동으로 해야 할 부분

- summary 내용 작성 (판단, 작업, 커밋 해시 등은 사람이 판단)
- 실제 대화 전문의 임시 파일에서 rename (데이터 이동)
- 중요한 커밋 해시 추출 (컴1/컴2 확인 필요)

## 주의사항

1. **naming 규칙 절대 준수** - 이미 생성된 파일과 형식이 달라지면 자동화 파이프라인이 깨짐
2. **summary는 짧고 정확하게** - 다음 세션 진입용이므로 장황한 설명 금지
3. **커밋 해시는 정확히** - 컴1/컴2에서 실제 존재하는 해시만 기재
4. **충돌 방지** - 동일 날짜에 이미 파일이 있으면 회차(NN)를 자동 증가

## 예시

full 파일명: `2026-04-17-01-runtime-stabilization.md`  
summary 파일명: `2026-04-17-01-runtime-stabilization_summary.md`

summary 내용:
```markdown
# 2026-04-17: 런타임 안정화

## 세션 핵심 주제
i18n 딕셔너리 정리, shared-header 회귀 복구, 에셋 버저닝.

## 확정된 판단
1. isEditorPage() 보수적 복원 (3209356)
2. i18n speculative key 정리 (f8817c8)

## 완료된 주요 작업
- ✅ shared-header.js 회귀 수정 (3209356)
- ✅ i18n.js 실사용 기준 정리

## 중요한 커밋 해시
- `3209356` fix: isEditorPage()
- `f8817c8` refactor(i18n)

## 남은 Blocker
- [ ] 원격 푸시
```

## 스킬 사용 방법

```bash
# 세션 종료 시 실행
/session-documentation

# 스킬이 자동으로:
# 1. 날짜/회차 파악
# 2. full/summary 파일명 제안
# 3. summary 템플릿 생성
# 4. full_index.md, summary_index.md 업데이트
# 5. rename 필요한 임시 파일이 있으면 이동 제안
```

## 출력 위치

- `docs/conversation/full/YYYY-MM-DD-NN-*.md`
- `docs/conversation/summary/YYYY-MM-DD-NN-*_summary.md`
- `docs/conversation/full/full_index.md` (업데이트)
- `docs/conversation/summary/summary_index.md` (업데이트)
