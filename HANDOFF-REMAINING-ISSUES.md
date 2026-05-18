# LoveBud 이슈 정리 - Handoff 문서

## ✅ 완료된 작업

### Issue #1286 - memories 테이블 migration 재작성
- **상태**: Migration 파일 수정 완료
- **변경 내용**:
  - `memory_id` → `tree_id` 변경
  - `REFERENCES trees(id)` 적용
  - `reaction_type`, `comment_type` 컬럼 추가
  - `ON DELETE CASCADE` 적용
- **파일**: `scripts/migration-add-reactions-comments.sql`
- **다음 단계**: `wrangler d1 execute` 로 검증 필요

---

## 📋 남은 이슈 (17개)

### Priority 1 - Bug Fix 필요
| 번호 | 제목 | 라벨 | 비고 |
|------|------|------|------|
| #1236 | UI: resolve duplicate detail-action buttons in Editor right panel | frontend | 닫힘 (2026-05-17) |
| #1230 | fix(editor): remove unusable '내 러브트리에 기록하기' button | frontend | 닫힘 |
| #1229 | fix(editor): first created moment disappears after save | frontend | 닫힘 |
| #1228 | fix(editor): '내 러브트리에 기록하기' button visible during drag | frontend | 닫힘 |

### Priority 2 - Refactor (품질 개선)
| 번호 | 제목 | 라벨 |
|------|------|------|
| #1285 | Refactor: split My Trees UI runtime into rendering and interaction modules | frontend |
| #1284 | Refactor: split Modal owner write handlers by write responsibility | backend |
| #1283 | Refactor: audit and modularize auth entry runtime safely | frontend |
| #1282 | Refactor: split public tree viewer runtime by viewer responsibility | frontend |
| #1281 | Refactor: split Browse search UI runtime into smaller interaction modules | frontend |
| #1280 | Refactor: slim editor page HTML by extracting static templates | frontend |
| #1279 | Refactor: split editor detail panel CSS into focused sections | frontend |
| #1278 | Refactor: split editor canvas toolbar CSS by toolbar surface | frontend |
| #1277 | Refactor: split editor canvas runtime into focused rendering and interaction modules | frontend |
| #1276 | Refactor: reduce legacy editor entrypoint size and clarify responsibilities | frontend |
| #1275 | Refactor: split oversized editor floating toolbar runtime into focused modules | frontend |

### Priority 3 - Feature/UX
| 번호 | 제목 | 라벨 |
|------|------|------|
| #1274 | Editor UX: support drag-and-drop URL or YouTube thumbnail to create moment | frontend, UX, product |
| #1273 | Moment creation: allow URL-only quick save with automatic defaults | frontend, UX, product |
| #1272 | Mobile UX: add bottom action bar for quick moment creation in Editor | frontend, UX, product |
| #1271 | Mobile UX: open My Trees item directly into Editor on tap | frontend, UX, product |
| #1270 | Mobile UX: open public tree directly from Browse card tap | frontend, UX, product |

---

## 🎯 실행 권장 순서

1. **Issue #1286** - Migration 검증 및 merge (진행 중)
2. **Bug Fix 이슈** - 이미 닫힌 것으로 보임, 재검증 필요
3. **Refactor 이슈** - MiMo에게 Design PR → Runtime PR 파이프라인 적용
4. **Feature 이슈** - 순차 처리

## 📝 MiMo 실행 명령어

```bash
# Migration 검증
npx @gitlawb/openclaude --provider openai --model mimo-v2.5-pro \
  --allowedTools "Read,Bash" \
  -p "scripts/migration-add-reactions-comments.sql SQL syntax 검증하고 수정사항 확인"

# Refactor 이슈 처리
npx @gitlawb/openclaude --provider openai --model mimo-v2.5-pro \
  --allowedTools "Read,Bash,Edit" \
  -p "Issue #<번호>에 따라 코드 분리 및 리팩토링"
```

---

작성일: 2026-05-17
작성자: Hermes Agent (CTO)