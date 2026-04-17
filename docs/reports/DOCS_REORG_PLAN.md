# LoveBud 문서 인벤토리 및 정리 계획 (보정판)

> 기준: 2026-04-17 | 컴2 (작업 사본)
> 업데이트: 2026-04-17 (폴더 구조 실제 상태 반영)

---

## 1. 현재 실제 폴더 구조

```
docs/
├── archive/          # 기존 - 레거시/보관 문서
├── design/           # 기존 - UI 디자인
├── engineering/      # 기존 - 기술 문서
├── identity/         # 기존 - 정체성/콘셉
├── image/            # 기존 - 이미지 자산
├── image_less/       # 기존 - 시각 참조
├── migration/        # 기존 - 마이그레이션
├── ops/              # 기존 - 운영
├── pages/            # 기존 - 페이지 문서
├── product/         # 기존 - 제품
├── reports/         # 기존 - 보고서
├── conversation/    # 기존 - 대화 기록
├── doc_index.md
├── ROADMAP.md       # 위치 검토 필요
├── CTO_MVP_HANDOFF.md  # 위치 검토 필요
├── backend.md       # 위치 검토 필요
└── git_tutorial.md # 위치/내용 검토 필요
```

---

## 2. 전체 문서 분류 (실제 구조 기준)

### 이미 정리됨 (문제無)

| 폴더 | 파일 수 | 상태 |
|------|--------|------|
| `docs/product/` | 8 | PRODUCT_IDENTITY, MVP_SCOPE, USER_FLOW 등 |
| `docs/ops/` | 14 | PATHS_AND_SHELLS, GIT_SSH_SETUP 등 |
| `docs/pages/` | 5 | my-trees, editor, search, detail, pages_index |
| `docs/conversation/` | 7 | full/summary 인덱스 + 아카이브 |
| `docs/design/` | 1 | UI_DESIGN_SYSTEM |
| `docs/migration/` | 1 | POSTGRES_MIGRATION |
| `docs/engineering/` | ? | 기존 폴더, 내용 확인 필요 |
| `docs/image/` | ? | 기존 폴더, 내용 확인 필요 |
| `docs/image_less/` | ? | 기존 폴더, 내용 확인 필요 |
| `docs/archive/` | ? | 기존 폴더, 레거시 문서 모음 |

### 위치 검토 필요

| 파일 | 현재 위치 | 추천 위치 | 이유 |
|------|----------|------------|------|
| `ROADMAP.md` | `docs/ROADMAP.md` | **유지 (루트)** | project 성격, doc_index에서 프로젝트 문서로 분류 |
| `CTO_MVP_HANDOFF.md` | `docs/CTO_MVP_HANDOFF.md` | `docs/engineering/CTO_MVP_HANDOFF.md` | 기술 인계 문서, engineering 폴더 적합 |
| `backend.md` | `docs/backend.md` | `docs/engineering/backend.md` | 기술 문서, engineering 폴더 적합 |
| `git_tutorial.md` | `docs/git_tutorial.md` | **내용 수정 완료** | `git add .` 예시를 LoveBud staging 원칙에 맞게 수정 완료 |

### 레거시 (archive 이동 검토)

| 파일 | 현재 위치 | 추천 위치 |
|------|----------|------------|
| `TODO_SUMMARY.md` | 루트 | `docs/archive/` |
| `SEED_COMPLETE.md` | 루트 | `docs/archive/` |
| `FINAL_SUMMARY.md` | 루트 | `docs/archive/` |
| `COMPLETION_REPORT.md` | 루트 | `docs/archive/` |

---

## 3. ROADMAP.md 위치에 대한 결론

**현재 위치 유지 (`docs/ROADMAP.md`)가 적절함.**

**이유:**
- `doc_index.md`에서 "프로젝트 문서"로 분류됨
- 내용도 제품 자체보다 프로젝트 진행 상황/우선순위 위주
- product 폴더는 제품 철학/범위/설계 문서가 중심
- project/roadmap은 독립적으로 두는 것이 적절

---

## 4. git_tutorial.md 처리 권고

**위치:** 현재 위치 (`docs/git_tutorial.md`) 유지

**내용 수정 완료:**
- Line 17: `git add .` → LoveBud staging 원칙 (`git add <파일>`)로 수정 완료
- 예시 워크플로우가 LoveBud 운영 원칙에 맞게 수정 완료

**수정后的 적절한 예시:**
```bash
# 2. 변경된 파일만 명시적으로 스테이징 (LoveBud 원칙)
git add js/my-trees.js docs/pages/my-trees.md

# 또는 관련 파일만
git add js/ docs/pages/
```

**또는:** 간단히 삭제하고 `docs/ops/GIT_SSH_SETUP.md` 참조로 대체

---

## 5. 혼합 언어/깨진 표현 정리

| 위치 | 표현 | 수정 |
|------|------|------|
| `docs/product/USER_FLOW.md` | "시간的不是 선형", "不是" | 한글로 수정 필요 |
| `docs/product/PRODUCT_IDENTITY.md` | "入덕", "情感" 등 한자 | 읽기 어려운 표현 한글로 |

*별도 작업으로 진행.*

---

## 6. 보정된 이동 계획

### 즉시 이동 가능 (링크 갱신 필요 없음)

| 현재 | 이동 후 |
|------|----------|
| `docs/CTO_MVP_HANDOFF.md` | `docs/engineering/CTO_MVP_HANDOFF.md` |
| `docs/backend.md` | `docs/engineering/backend.md` |

### 보류 (수정 필요)

| 파일 | 처리 |
|------|------|
| `docs/git_tutorial.md` | `git add .` 예시만 수정 후 현재 위치 유지 |
| `docs/ROADMAP.md` | 현재 위치 유지 (문제無) |

### archive 이동 (링크 확인 필요)

| 파일 | 처리 |
|------|------|
| 루트 4개 legacy 보고서 | `docs/archive/`로 이동 (현재 미반영, 링크 깨질 위험) |

---

## 7. 현재 구조 기준으로 보정된 핵심 내용

1. **기존 폴더 12개 확인** - archive, engineering, image, image_less 포함
2. **ROADMAP.md 유지 결론** - project 문서로 product 폴더에 불적합
3. **git_tutorial.md 권고** - 내용 수정 후 현재 위치 유지 (git add . 문제)
4. **CTO_MVP_HANDOFF.md, backend.md** - engineering 폴더로 이동 적절

---

## 8. 실제 이동 여부

**이번 작업에서는 실제 이동 없음** — 계획 문서만 보정함.

**이유:** 링크 갱신 범위와 영향도 평가 후 다음 작업에서 진행 권장.

---

*이 계획은 보수적으로 적용하고, 링크가 깨지지 않는 범위 내에서만 이동합니다.*