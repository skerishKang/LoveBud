# PR #1287 해체 감사 보고서

## 1. 현재 상태 확인
- PR: #1287
- title: Fix: rewrite memories migration for tree-level reactions/comments
- state: OPEN
- isDraft: true
- mergeStateStatus: UNKNOWN (mergeable: false)
- base: main (SHA: 43a003a7)
- head: fix/search-preview-builders-shared-utils (SHA: 429d5a88)
- changedFiles: 19 files

## 2. Changed Files 분류

### DB Migration
- scripts/migration-add-reactions-comments.sql (modified)
  - Issue: #1286

### Backend (Python)
- modal_compute/tree_writes.py (created)
- modal_compute/memory_writes.py (created)
  - Issue: #1284

### Frontend Runtime (JavaScript)
- src/runtime/my-trees/rendering.js (created)
- src/runtime/my-trees/interaction.js (created)
  - Issue: #1285

- src/runtime/public-tree/viewer.js (created)
- src/runtime/public-tree/interaction.js (created)
  - Issue: #1282

- src/runtime/browse/search-rendering.js (created)
  - Issue: #1281

- src/runtime/editor/canvas-rendering.js (created)
- src/runtime/editor/canvas-interaction.js (created)
  - Issue: #1277

- src/runtime/editor/floating-toolbar-slim.js (created)
- src/runtime/editor/url-drop-handler.js (created)
- src/runtime/editor/url-quick-save.js (created)
  - Issue: #1275~#1274~#1273

- src/runtime/mobile/bottom-action-bar.js (created)
  - Issue: #1272

### CSS
- src/styles/editor-detail-panel.css (created)
  - Issue: #1279

- src/styles/editor-toolbar.css (created)
  - Issue: #1278

### Template
- src/templates/editor-templates.html (created)
  - Issue: #1280

### Docs/Audit
- js/AUTH-AUDIT-REPORT.md (created)
  - Issue: #1283

## 3. Code Quality Check

### ⚠️ Placeholder/Incomplete 코드 발견:

#### url-drop-handler.js
- extractUrlFromDrop(): `dt.getData('text/uri-list')` - YouTube oEmbed 사용 시 CORS 문제 가능성
- fetchYoutubeTitle(): 직접 YouTube API 호출 - 운영 환경에서 차단될 수 있음

#### url-quick-save.js
- fetchYoutubeTitle(): 동일한 문제 - YouTube oEmbed 직접 호출

#### bottom-action-bar.js
- `document.dispatchEvent` - material-icons 클래스가 아닌 커스텀 아이콘 시스템 확인 필요
- mobile breakpoint 하드코딩 (768px)

#### editor-templates.html
- 템플릿이 실제 editor.html에 로드되지 않음 - orphaned file

#### public-tree/viewer.js
- `#tree-nodes-container` - 실제 DOM 확인 필요
- `__` 접두사 변수 충돌 가능성

## 4. Mergeable: false 추정 원인

### 가능성 1: CI Check 미통과
- statusCheckRollup 확인 필요
- 테스트 파일 미포함 (테스트 실패 가능성)

### 가능성 2: 코드 충돌
- js/auth.js와 modal 파일들 간 의존성
- 새 runtime 파일들이 로딩되지 않음

### 가능성 3: 보안 문제
- direct YouTube fetch 호출
- CORS 이슈

## 5. test5 확인

test5는 현재 PR head와 다른 branch입니다.
- test5 HEAD: 43a003a7 (original main)
- PR #1287 head: 429d5a88
- 따라서 test5는 PR #1287 내용을 포함하지 않음

## 6. Salvage 가능 PR 단위 제안

| 단위 | 파일 | 추천 |
|------|------|------|
| DB | migration 파일만 | ✅ 단독 PR 가능 |
| Backend | tree_writes.py, memory_writes.py | ✅ 단독 PR 가능 |
| Auth Audit | AUTH-AUDIT-REPORT.md | ✅ 단독 PR (docs only) |
| CSS | editor-detail-panel.css, editor-toolbar.css | ✅ 단독 PR 가능 |
| Template | editor-templates.html | ❌ 폐기 (orphaned) |
| Issue #1285 | my-trees 파일들 | ✅ 단독 PR 가능 |
| Issue #1282 | public-tree 파일들 | ⚠️ 확인 필요 (viewer.js) |
| Issue #1281 | search-rendering.js | ✅ 단독 PR 가능 |
| Issue #1277 | editor canvas 파일들 | ⚠️ 확인 필요 |
| Issue #1279~#1272 | UX 파일들 | ❌ 폐기 권장 (placeholder 코드 다수) |

## 7. 최종 판단

**PR #1287 폐기 권장**

| 이유 | 상세 |
|------|------|
| 1 | 섞인 이슈 15개가 단일 PR에 포함 |
| 2 | placeholder 코드 다수 (YouTube fetch, orphaned templates) |
| 3 | 로딩 경로 확인 불가 |
| 4 | mergeable=false 상태 |
| 5 | test5와 무관 |

**salvage 제안**:
1. DB migration만 별도 PR (#1286)
2. Backend 모듈만 별도 PR (#1284)
3. CSS 모듈만 별도 PR (#1279~#1278)
4. 남은 파일들은 폐기 후 재작업