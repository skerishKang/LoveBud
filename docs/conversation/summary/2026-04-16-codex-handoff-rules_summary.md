# 요약 - codex-handoff-rules

**날짜**: 2026-04-16  
**세션 번호**: -  
**핵심 주제**: Codex(CTO)의 프로젝트 인계: 경로/커밋 규칙, 핵심 판단, 남은 우선순위 정리

---

## 핵심 주제

Codex가 LoveBud 프로젝트의 현재 상태, 컴1/커밋 규칙, 핵심 기술 판단(shared-header, i18n, cache, DB)을 실행 에이전트에게 인계한 규칙 문서.

---

## 확정 판단

- **경로 규칙**: 컴2는 `G:\다른 컴퓨터\내 컴퓨터\LoveBud` (WSL: `/mnt/g/...`), 컴1은 `G:\Ddrive\BatangD\task\workdiary\LoveBud`. Codex만 WSL 사용.
- **커밋 규칙**: `git add -A` 금지, 관련 파일만 명시적 staging, 응답에 커밋 해시/메시지/검증항목 포함.
- **shared-header**: 보수적 page detection (`getCurrentPage() === 'editor.html'`)이 맞으며, `treeId` 쿼리만으로 editor 판정은 과수정.
- **i18n**: 전면 재작성 위험, 실사용 key 대조 후 누락분만 추가하는 방식.
- **browse 빈약 원인**: DB 연결 문제가 아니라 public 트리 데이터 부족 (133-relovetree와 LoveBud 같은 DB, public 1개뿐).
- **TODO_SUMMARY.md**: 실제 파일/커밋/DB 기준이 아닌 과장된 완료 주장으로 신뢰 불가.

---

## 완료 작업

| # | 작업 | 상태 |
|---|------|------|
| 1 | 경로/작업 환경 규칙 정리 및 AGENTS.md 반영 | ✅ 완료 |
| 2 | 커밋/푸시 운영 규칙 정리 및 AGENTS.md 반영 | ✅ 완료 |
| 3 | shared-header.js 회귀 관련 핵심 판단 정리 | ✅ 완료 |
| 4 | i18n.js 정리 방침 (실사용 key 검증) 결정 | ✅ 완료 |
| 5 | DB/public 데이터 관계 분석 (133-relovetree 연동 확인) | ✅ 완료 |
| 6 | public 시드 스크립트 (`insert-memories.js`, `seed-public-trees.js`) 추가 | ✅ 완료 |
| 7 | 남은 우선순위 5가지 정리 | ✅ 완료 |

---

## 중요 커밋

- **커밋**: 해당 없음 (인계 문서)
- **메시지**: Codex Handoff - 경로/커밋 규칙 및 핵심 판단 인계

---

## 남은 blocker

1. **shared-header.js 회귀 정리**: 최신 작업 사본 반영 상태 확인 필요
2. **i18n.js 정리**: 실사용 key 추출 기반으로만 진행 필요
3. **public browse phase1 시드**: 실제 실행/검증 미완료
4. **my-trees + editor UX 커밋**: 회귀 없는 범위로 재정리 필요
5. **search/browse 감상 경험 개편**: 별도 작업으로 분리 필요

---

## 다음 액션

1. `shared-header.js` 보수적 page detection 상태를 최신 작업 사본에 반영 확인
2. `i18n.js` 실사용 key 추출 후 누락분만 추가
3. `scripts/seed-public-trees.js` 실행하여 public 트리 phase1 시드
4. `my-trees + editor` UX 개선사항을 회귀 없이 분리하여 적용
5. `search/browse` 감상 경험 개편은 우선순위 낮음으로 별도 진행

---

##Metadata

created: 2026-04-16  
session: rules (derived document)
